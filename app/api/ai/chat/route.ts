import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { executeAICompletion } from "@/lib/ai/client";
import { buildSystemPromptWithERPContext, getERPContextForAI } from "@/lib/ai/context";
import { AIMessage, AIProviderId } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const messages: AIMessage[] = body.messages || [];
    const provider: AIProviderId | undefined = body.provider;
    const model: string | undefined = body.model;
    const apiKey: string | undefined = body.apiKey;
    const baseUrl: string | undefined = body.baseUrl;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma mensagem fornecida para o chat." },
        { status: 400 }
      );
    }

    // Coleta dados reais consolidados do ERP
    const erpContext = await getERPContextForAI();
    const systemPrompt = buildSystemPromptWithERPContext(erpContext, user?.name);

    const completion = await executeAICompletion({
      provider,
      model,
      apiKey,
      baseUrl,
      messages,
      systemPrompt,
      temperature: 0.6,
      maxTokens: 3000,
    });

    return NextResponse.json({
      ok: true,
      text: completion.text,
      provider: completion.provider,
      model: completion.model,
      latencyMs: completion.latencyMs,
    });
  } catch (error: any) {
    console.error("[API AI Chat Error]:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Erro ao processar sua solicitação no Copilot de IA.",
      },
      { status: 500 }
    );
  }
}
