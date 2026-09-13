import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit, requestIdentity } from "@/lib/rate-limit";
import {
  disconnectAgent,
  isAgentProvider,
  readAgentLogin,
  startAgentLogin,
  submitAgentLogin,
} from "@/lib/ai/agent-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

async function requireAgentUser() {
  const user = await getCurrentUser();
  return user
    ? { user, response: null }
    : { user: null, response: NextResponse.json({ ok: false, error: "Sessão expirada. Entre novamente." }, { status: 401, headers: privateHeaders }) };
}

async function providerFrom(params: Promise<{ provider: string }>) {
  const { provider } = await params;
  return isAgentProvider(provider) ? provider : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireAgentUser();
  if (auth.response) return auth.response;
  const provider = await providerFrom(params);
  if (!provider) return NextResponse.json({ ok: false, error: "Agente não suportado." }, { status: 400, headers: privateHeaders });
  return NextResponse.json({ ok: true, ...(await readAgentLogin(auth.user.id, provider)) }, { headers: privateHeaders });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireAgentUser();
  if (auth.response) return auth.response;
  const rate = consumeRateLimit(`ai-agent:${auth.user.id}:${await requestIdentity()}`, 10, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Muitas tentativas de conexão. Aguarde alguns minutos." }, { status: 429, headers: { ...privateHeaders, "Retry-After": String(rate.retryAfterSeconds) } });
  const provider = await providerFrom(params);
  if (!provider) return NextResponse.json({ ok: false, error: "Agente não suportado." }, { status: 400, headers: privateHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const state = typeof body.code === "string"
      ? submitAgentLogin(auth.user.id, provider, body.code)
      : await startAgentLogin(auth.user.id, provider);
    return NextResponse.json({ ok: state.status !== "failed", ...state }, { status: state.status === "failed" ? 503 : 200, headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão." }, { status: 500, headers: privateHeaders });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requireAgentUser();
  if (auth.response) return auth.response;
  const provider = await providerFrom(params);
  if (!provider) return NextResponse.json({ ok: false, error: "Agente não suportado." }, { status: 400, headers: privateHeaders });
  try {
    await disconnectAgent(auth.user.id, provider);
    await logAudit({ action: "DELETE", entity: "Conexão de IA", summary: `Desconectou ${provider === "openai" ? "Codex" : "Claude Code"}` });
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível desconectar." }, { status: 500, headers: privateHeaders });
  }
}
