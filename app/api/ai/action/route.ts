import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/ai/guard";
import { isActionKind, ACTION_LABELS } from "@/lib/ai/action-protocol";
import { executeAIAction } from "@/lib/ai/actions";
import { consumeRateLimit, requestIdentity } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Executa UMA ação sugerida pelo DeskHelper AI, depois da confirmação humana.
 *
 * Esta rota é o único ponto em que a IA escreve no banco, e ela não fala com
 * modelo nenhum: recebe do navegador o tipo de ação e os campos, e valida
 * tudo de novo em `executeAIAction`. Ou seja, mesmo que alguém chame a rota
 * direto (sem passar pelo chat), as regras são as mesmas.
 *
 * O corpo vem de um clique do usuário, mas o conteúdo foi escrito por um
 * modelo — então continua sendo entrada não confiável, e é tratada como tal.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  // Limite próprio, mais apertado que o do chat: conversar é barato, gravar
  // não. Sem isto, um laço no cliente criaria dezenas de registros por minuto.
  const ip = await requestIdentity();
  const rate = consumeRateLimit(`ai-write:${auth.user.id}:${ip}`, 10, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Muitas criações seguidas pela IA. Aguarde um instante antes de confirmar outra.",
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const payload = body as { acao?: unknown; dados?: unknown };
  if (!isActionKind(payload.acao)) {
    return NextResponse.json(
      { ok: false, error: "Ação não permitida." },
      { status: 400 },
    );
  }
  if (!payload.dados || typeof payload.dados !== "object" || Array.isArray(payload.dados)) {
    return NextResponse.json(
      { ok: false, error: "Dados da ação ausentes ou malformados." },
      { status: 400 },
    );
  }

  try {
    const result = await executeAIAction(
      payload.acao,
      payload.dados as Record<string, unknown>,
      auth.user,
    );

    if (!result.ok) {
      // 422: a ação é conhecida e o usuário pode executá-la, mas os dados que
      // o modelo montou não passaram na validação.
      return NextResponse.json(result, { status: 422 });
    }

    // As telas são force-dynamic, mas o cache de rota do App Router ainda
    // serviria a listagem anterior na primeira navegação depois da criação.
    for (const path of ["/", result.href, hrefToList(result.href)]) {
      revalidatePath(path);
    }

    return NextResponse.json({
      ok: true,
      label: ACTION_LABELS[payload.acao],
      entity: result.entity,
      id: result.id,
      summary: result.summary,
      href: result.href,
    });
  } catch (error) {
    // A mensagem original pode carregar detalhe de schema ou SQL; fica no log.
    console.error("[API AI Action Error]:", error);
    return NextResponse.json(
      { ok: false, error: "Não foi possível concluir a criação. Tente pela tela do módulo." },
      { status: 500 },
    );
  }
}

/** "/leads/12" -> "/leads" (a listagem também precisa ser revalidada). */
function hrefToList(href: string): string {
  const cut = href.indexOf("/", 1);
  return cut === -1 ? href : href.slice(0, cut);
}
