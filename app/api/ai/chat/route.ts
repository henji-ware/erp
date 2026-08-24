import { NextRequest, NextResponse } from "next/server";
import { executeAICompletion, streamAICompletion } from "@/lib/ai/client";
import { buildSystemPromptWithERPContext, getERPContextForAI } from "@/lib/ai/context";
import { errorMessage, requireUser } from "@/lib/ai/guard";
import { isAdmin } from "@/lib/auth";
import { AIMessage, AIProviderId } from "@/lib/ai/types";
import { resolveApiKey, resolveBaseUrl } from "@/lib/ai/credentials";
import { isAIProviderId } from "@/lib/ai/providers";

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

    const provider: AIProviderId | undefined = isAIProviderId(body.provider)
      ? body.provider
      : undefined;

    // A chave vem do BANCO, cifrada por usuário — nunca do corpo da
    // requisição. Antes o navegador a enviava em toda mensagem do chat, o
    // que a expunha a qualquer script da página e a qualquer proxy no
    // caminho. `body.apiKey` é ignorado de propósito.
    const apiKey = provider ? await resolveApiKey(auth.user.id, provider) : undefined;
    const baseUrl = provider ? await resolveBaseUrl(auth.user.id, provider) : undefined;

    const options = {
      provider,
      model: typeof body.model === "string" ? body.model : undefined,
      apiKey,
      baseUrl,
      messages,
      systemPrompt: buildSystemPromptWithERPContext(
        await getERPContextForAI(auth.user),
        auth.user,
      ),
      temperature: 0.6,
      maxTokens: 3000,
      isAdmin: isAdmin(auth.user),
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
              // Repassa tanto o texto quanto os avisos de nova tentativa, para
              // a tela dizer "tentando de novo" em vez de mostrar erro.
              send(next.value);
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
              error: errorMessage(error, "Erro ao processar sua solicitação no DeskHelper AI."),
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
      { ok: false, error: errorMessage(error, "Erro ao processar sua solicitação no DeskHelper AI.") },
      { status: 500 }
    );
  }
}
