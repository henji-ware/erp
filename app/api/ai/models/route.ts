import { NextRequest, NextResponse } from "next/server";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "@/lib/ai/settings";
import { AIModelInfo, AIProviderId } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider: AIProviderId = body.provider || "openai";
    const userApiKey: string | undefined = body.apiKey;
    const userBaseUrl: string | undefined = body.baseUrl;

    const providerConfig = AI_PROVIDERS[provider];
    const apiKey = getEffectiveApiKey(provider, userApiKey);
    const baseUrl = getEffectiveBaseUrl(provider, userBaseUrl);

    if (providerConfig?.requiresApiKey && !apiKey) {
      return NextResponse.json(
        {
          error: `Insira uma chave de API para carregar os modelos disponíveis no ${providerConfig.name}.`,
          fallbackModels: providerConfig.models,
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
  } catch (error: any) {
    console.error("[API AI Models Error]:", error);
    return NextResponse.json(
      {
        error: error.message || "Não foi possível carregar a lista de modelos da API.",
      },
      { status: 500 }
    );
  }
}

async function fetchLiveModels(
  provider: AIProviderId,
  apiKey?: string,
  baseUrl?: string
): Promise<AIModelInfo[]> {
  const preConfigured = AI_PROVIDERS[provider]?.models || [];

  switch (provider) {
    case "gemini": {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        apiKey!
      )}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google API retornou erro ${res.status}: ${text}`);
      }
      const data = await res.json();
      const list: AIModelInfo[] = (data.models || [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes("generateContent")
        )
        .map((m: any) => {
          const cleanId = m.name.replace(/^models\//, "");
          const existing = preConfigured.find((p) => p.id === cleanId);
          return {
            id: cleanId,
            name: m.displayName || cleanId,
            description: m.description || existing?.description,
            contextWindow: m.inputTokenLimit
              ? `${Math.round(m.inputTokenLimit / 1000)}k`
              : existing?.contextWindow,
            tier: existing?.tier || "flagship",
          };
        });
      return list.length > 0 ? list : preConfigured;
    }

    case "ollama": {
      const targetUrl = `${(baseUrl || "http://localhost:11434").replace(
        /\/+$/,
        ""
      )}/api/tags`;
      const res = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`Ollama retornou status ${res.status}`);
      const data = await res.json();
      const list: AIModelInfo[] = (data.models || []).map((m: any) => ({
        id: m.name,
        name: `${m.name} (${Math.round((m.size || 0) / 1024 / 1024 / 1024)}GB)`,
        description: `Modelo local modificado em ${new Date(
          m.modified_at
        ).toLocaleDateString()}`,
        tier: "flagship",
      }));
      return list.length > 0 ? list : preConfigured;
    }

    case "openrouter": {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!res.ok) throw new Error(`OpenRouter retornou erro ${res.status}`);
      const data = await res.json();
      const list: AIModelInfo[] = (data.data || []).slice(0, 40).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description?.slice(0, 100) || "",
        contextWindow: m.context_length
          ? `${Math.round(m.context_length / 1000)}k`
          : undefined,
        tier: "flagship",
      }));
      return list.length > 0 ? list : preConfigured;
    }

    case "openai":
    case "groq":
    case "deepseek":
    case "mistral":
    case "xai":
    case "custom": {
      let endpoint = `${(baseUrl || "https://api.openai.com").replace(/\/+$/, "")}`;
      if (!endpoint.endsWith("/models")) {
        endpoint = endpoint.endsWith("/v1") ? `${endpoint}/models` : `${endpoint}/v1/models`;
      }

      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(endpoint, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${provider.toUpperCase()} erro ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const rawList = data.data || data.models || [];
      const list: AIModelInfo[] = rawList
        .filter((m: any) => {
          const id = typeof m === "string" ? m : m.id;
          if (!id) return false;
          // Filtrar modelos puramente de embedding/áudio/whisper/dall-e se for OpenAI
          if (
            id.includes("embedding") ||
            id.includes("whisper") ||
            id.includes("dall-e") ||
            id.includes("tts") ||
            id.includes("moderation")
          ) {
            return false;
          }
          return true;
        })
        .map((m: any) => {
          const id = typeof m === "string" ? m : m.id;
          const existing = preConfigured.find((p) => p.id === id);
          return {
            id,
            name: existing?.name || id,
            description: existing?.description || `Modelo disponível na API`,
            tier: existing?.tier || "flagship",
            contextWindow: existing?.contextWindow,
          };
        });

      return list.length > 0 ? list : preConfigured;
    }

    case "anthropic":
    default:
      return preConfigured;
  }
}
