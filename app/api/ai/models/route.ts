import { NextRequest, NextResponse } from "next/server";
import { AI_PROVIDERS, isAIProviderId } from "@/lib/ai/providers";
import { assertSafeBaseUrl, getEffectiveBaseUrl } from "@/lib/ai/settings";
import { errorMessage, requireUser } from "@/lib/ai/guard";
import { AIModelInfo, AIProviderId } from "@/lib/ai/types";
import { resolveApiKey, resolveBaseUrl } from "@/lib/ai/credentials";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8000;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    if (!isAIProviderId(body.provider)) {
      return NextResponse.json({ ok: false, error: "Provedor desconhecido." }, { status: 400 });
    }

    const provider: AIProviderId = body.provider;
    const providerConfig = AI_PROVIDERS[provider];
    // Esta rota é uma das DUAS que ainda aceitam chave no corpo, e por um
    // motivo legítimo: ao cadastrar uma chave nova a pessoa quer carregar os
    // modelos antes de salvar. Se o corpo não trouxer chave, vale a guardada.
    const digitada = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = digitada || (await resolveApiKey(auth.user.id, provider));

    const baseUrlDigitada = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const baseUrl = getEffectiveBaseUrl(
      provider,
      baseUrlDigitada || (await resolveBaseUrl(auth.user.id, provider)),
    );

    assertSafeBaseUrl(provider, baseUrl);

    if (providerConfig.requiresApiKey && !apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: `Informe uma chave de API para carregar os modelos disponíveis no ${providerConfig.name}.`,
        },
        { status: 400 }
      );
    }

    const liveModels = await fetchLiveModels(provider, apiKey, baseUrl);

    return NextResponse.json({
      ok: true,
      provider,
      count: liveModels.length,
      models: liveModels,
    });
  } catch (error) {
    console.error("[API AI Models Error]:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Não foi possível carregar a lista de modelos.") },
      { status: 500 }
    );
  }
}

function timeout(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

/** Enriquece o ID cru da API com o texto do catálogo local, quando houver. */
function decorate(id: string, preConfigured: AIModelInfo[], extra?: Partial<AIModelInfo>): AIModelInfo {
  const existing = preConfigured.find((p) => p.id === id);
  return {
    id,
    name: extra?.name || existing?.name || id,
    description: extra?.description || existing?.description || "Modelo disponível na sua conta.",
    tier: existing?.tier || "flagship",
    contextWindow: extra?.contextWindow || existing?.contextWindow,
    isNew: existing?.isNew,
  };
}

async function fetchLiveModels(
  provider: AIProviderId,
  apiKey?: string,
  baseUrl?: string
): Promise<AIModelInfo[]> {
  const preConfigured = AI_PROVIDERS[provider]?.models || [];

  switch (provider) {
    case "gemini": {
      const url = `${(baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "")}/v1beta/models?key=${encodeURIComponent(apiKey!)}&pageSize=200`;
      const res = await fetch(url, { signal: timeout() });
      if (!res.ok) throw new Error(`Google respondeu ${res.status}. Verifique a chave de API.`);
      const data = await res.json();
      const list: AIModelInfo[] = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) =>
          decorate(String(m.name).replace(/^models\//, ""), preConfigured, {
            name: m.displayName,
            description: m.description,
            contextWindow: m.inputTokenLimit
              ? `${Math.round(m.inputTokenLimit / 1000)}k`
              : undefined,
          })
        );
      return list;
    }

    // A Anthropic expõe /v1/models, mas com autenticação por x-api-key.
    case "anthropic": {
      const res = await fetch(
        `${(baseUrl || "https://api.anthropic.com").replace(/\/+$/, "")}/v1/models?limit=100`,
        {
          headers: { "x-api-key": apiKey!, "anthropic-version": "2023-06-01" },
          signal: timeout(),
        }
      );
      if (!res.ok) throw new Error(`Anthropic respondeu ${res.status}. Verifique a chave de API.`);
      const data = await res.json();
      const list: AIModelInfo[] = (data.data || []).map((m: any) =>
        decorate(m.id, preConfigured, { name: m.display_name })
      );
      return list;
    }

    case "ollama": {
      const res = await fetch(
        `${(baseUrl || "http://localhost:11434").replace(/\/+$/, "")}/api/tags`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!res.ok) throw new Error(`Ollama respondeu ${res.status}.`);
      const data = await res.json();
      const list: AIModelInfo[] = (data.models || []).map((m: any) => ({
        id: m.name,
        name: `${m.name} (${Math.round((m.size || 0) / 1024 / 1024 / 1024)}GB)`,
        description: "Modelo instalado localmente via Ollama.",
        tier: "flagship" as const,
      }));
      return list;
    }

    case "openrouter": {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: timeout(),
      });
      if (!res.ok) throw new Error(`OpenRouter respondeu ${res.status}.`);
      const data = await res.json();
      const list: AIModelInfo[] = (data.data || [])
        .slice(0, 60)
        .map((m: any) =>
          decorate(m.id, preConfigured, {
            name: m.name,
            description: m.description?.slice(0, 120),
            contextWindow: m.context_length
              ? `${Math.round(m.context_length / 1000)}k`
              : undefined,
          })
        );
      return list;
    }

    default: {
      // Todos os demais expõem GET /v1/models no padrão OpenAI.
      let endpoint = (baseUrl || "https://api.openai.com").replace(/\/+$/, "");
      if (!endpoint.endsWith("/models")) {
        endpoint = endpoint.endsWith("/v1") ? `${endpoint}/models` : `${endpoint}/v1/models`;
      }

      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(endpoint, { headers, signal: timeout() });
      if (!res.ok) {
        throw new Error(
          `${AI_PROVIDERS[provider].name} respondeu ${res.status} ao listar modelos.`
        );
      }
      const data = await res.json();
      const rawList = data.data || data.models || [];
      const list: AIModelInfo[] = rawList
        .map((m: any) => (typeof m === "string" ? m : m?.id))
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        // Fora modelos que não servem para chat (embeddings, áudio, imagem).
        .filter(
          (id: string) =>
            !/embedding|whisper|dall-e|tts|moderation|image|audio|rerank/i.test(id)
        )
        .map((id: string) => decorate(id, preConfigured));

      return list;
    }
  }
}
