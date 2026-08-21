import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { consumeRateLimit, requestIdentity } from "@/lib/rate-limit";

/**
 * As rotas /api/ai/* recebem URL base e chave vindas do navegador e falam com a
 * internet a partir do servidor. O middleware já protege as páginas, mas para
 * uma chamada de API ele responde com redirect HTML — o que o fetch do cliente
 * lê como sucesso. Aqui a resposta é um 401 em JSON, e a checagem fica junto da
 * rota em vez de depender só de uma camada acima.
 */
export async function requireUser(): Promise<
  { user: CurrentUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Sessão expirada. Entre novamente para usar os recursos de IA." },
        { status: 401 }
      ),
    };
  }
  const ip = await requestIdentity();
  const rate = consumeRateLimit(`ai:${user.id}:${ip}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Limite de solicitações atingido. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      ),
    };
  }
  return { user };
}

/** Mensagem de erro segura para devolver ao navegador. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
