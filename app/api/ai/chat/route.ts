import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion, streamAICompletion } from "@/lib/ai/client";
import { buildSystemPromptWithERPContext, getERPContextForAI } from "@/lib/ai/context";
import { errorMessage, requireUser } from "@/lib/ai/guard";
import { AIMessage, AIProviderId } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/** O contexto do ERP já é grande; o histórico do chat é cortado para caber. */
const MAX_HISTORY_MESSAGES = 20;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();

    const rawMessages: AIMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages
      .filter(
        (m): m is AIMessage =>
          !!m && typeof m.content === "string" && ["user", "assistant", "system"].includes(m.role)
      )
      .slice(-MAX_HISTORY_MESSAGES);

    if (messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nenhuma mensagem fornecida para o chat." },
        { status: 400 }
      );
    }

    const provider: AIProviderId | undefined = body.provider;
    const options = {
      provider,
      model: typeof body.model === "string" ? body.model : undefined,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      messages,
      systemPrompt: buildSystemPromptWithERPContext(await getERPContextForAI(), auth.user.name),
      temperature: 0.6,
      maxTokens: 3000,
    };

    // Modo padrão: resposta em streaming, para o usuário ver o texto saindo.
    if (body.stream !== false) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Se o usuário fecha a aba no meio da resposta, o controller já está
          // fechado e enqueue lança. Sem esta proteção o próprio tratamento de
          // erro estouraria de novo, virando uma rejeição não tratada.
          let closed = false;
          const send = (payload: unknown) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            } catch {
              closed = true;
            }
          };
          try {
            const iterator = streamAICompletion({ ...options, signal: req.signal });
            let next = await iterator.next();
            while (!next.done) {
              send({ type: "delta", text: next.value });
              next = await iterator.next();
            }
            send({
              type: "done",
              model: next.value.model,
              provider: next.value.provider,
              latencyMs: next.value.latencyMs,
            });
          } catch (error) {
            send({
              type: "error",
              error: errorMessage(error, "Erro ao processar sua solicitação no Copilot de IA."),
            });
          } finally {
            if (!closed) {
              closed = true;
              try {
                controller.close();
              } catch {
                // já fechado pelo cliente
              }
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const completion = await executeAICompletion({ ...options, signal: req.signal });
    return NextResponse.json({
      ok: true,
      text: completion.text,
      provider: completion.provider,
      model: completion.model,
      latencyMs: completion.latencyMs,
    });
  } catch (error) {
    console.error("[API AI Chat Error]:", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Erro ao processar sua solicitação no Copilot de IA.") },
      { status: 500 }
    );
  }
}
