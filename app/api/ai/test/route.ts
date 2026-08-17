import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion } from "@/lib/ai/client";
import { errorMessage, requireUser } from "@/lib/ai/guard";
import { AIProviderId } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const provider: AIProviderId = body.provider;

    const result = await executeAICompletion({
      provider,
      model: typeof body.model === "string" ? body.model : undefined,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      messages: [{ role: "user", content: "Responda apenas: OK" }],
      maxTokens: 64,
      temperature: 0.1,
      signal: req.signal,
    });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      message: result.text.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Falha no teste de conexão com o provedor.") },
      { status: 400 }
    );
  }
}
