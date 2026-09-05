import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion } from "@/lib/ai/client";
import { errorMessage, requireUser } from "@/lib/ai/guard";
import { isAdmin } from "@/lib/auth";
import { AIProviderId } from "@/lib/ai/types";
import { isAIProviderId } from "@/lib/ai/providers";
import { resolveProviderAuth } from "@/lib/ai/credentials";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    if (!isAIProviderId(body.provider)) {
      return NextResponse.json({ ok: false, error: "Provedor desconhecido." }, { status: 400 });
    }
    const provider: AIProviderId = body.provider;

    // A outra rota que aceita chave digitada: testar antes de salvar é o
    // ponto dela. Sem chave no corpo, testa a que está guardada.
    const digitada = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrlDigitada = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";

    let retries = 0;
    const result = await executeAICompletion({
      provider,
      model: typeof body.model === "string" ? body.model : undefined,
      ...await resolveProviderAuth(auth.user.id, provider, digitada, baseUrlDigitada),
      messages: [{ role: "user", content: "Responda apenas: OK" }],
      maxTokens: 64,
      temperature: 0.1,
      signal: req.signal,
      isAdmin: isAdmin(auth.user),
      onRetry: () => {
        retries++;
      },
    });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      retries,
      message: result.text.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Falha no teste de conexão com o provedor.") },
      { status: 400 }
    );
  }
}
