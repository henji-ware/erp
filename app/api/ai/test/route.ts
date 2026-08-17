import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion } from "@/lib/ai/client";
import { AIProviderId } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider: AIProviderId = body.provider;
    const model: string = body.model;
    const apiKey: string | undefined = body.apiKey;
    const baseUrl: string | undefined = body.baseUrl;

    const result = await executeAICompletion({
      provider,
      model,
      apiKey,
      baseUrl,
      messages: [{ role: "user", content: "Responda apenas: OK (Conexão bem sucedida)" }],
      maxTokens: 50,
      temperature: 0.1,
    });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      message: result.text.trim(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Falha no teste de conexão com o provedor.",
      },
      { status: 400 }
    );
  }
}
