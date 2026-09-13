import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/ai/guard";
import { saveOAuthCredential } from "@/lib/ai/credentials";
import {
  OPENAI_DEVICE_TTL_SECONDS,
  openAIDeviceCookieName,
  pollOpenAIDeviceOAuth,
  startOpenAIDeviceOAuth,
} from "@/lib/ai/openai-device-oauth";
import { oauthOrigin } from "@/lib/ai/oauth";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== oauthOrigin()) {
      return NextResponse.json({ ok: false, error: "Origem não autorizada." }, { status: 403, headers: privateHeaders });
    }
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const flow = await startOpenAIDeviceOAuth(auth.user.id, req.cookies.get(SESSION_COOKIE)?.value || "");
    const response = NextResponse.json({
      ok: true,
      status: "waiting",
      verificationUrl: flow.verificationUrl,
      userCode: flow.userCode,
      intervalSeconds: flow.intervalSeconds,
    }, { headers: privateHeaders });
    response.cookies.set(openAIDeviceCookieName(), flow.cookie, { ...cookieOptions, maxAge: OPENAI_DEVICE_TTL_SECONDS });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão." }, { status: 503, headers: privateHeaders });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const result = await pollOpenAIDeviceOAuth(
      req.cookies.get(openAIDeviceCookieName())?.value,
      auth.user.id,
      req.cookies.get(SESSION_COOKIE)?.value || "",
    );
    if (result.status === "waiting") {
      return NextResponse.json({ ok: true, ...result }, { headers: privateHeaders });
    }
    await saveOAuthCredential(auth.user.id, result.credential);
    await logAudit({ action: "UPDATE", entity: "AICredential", summary: "Conectou OpenAI com conta ChatGPT" });
    const response = NextResponse.json({ ok: true, status: "connected" }, { headers: privateHeaders });
    response.cookies.set(openAIDeviceCookieName(), "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    const response = NextResponse.json({ ok: false, status: "failed", error: error instanceof Error ? error.message : "Não foi possível concluir a conexão." }, { status: 400, headers: privateHeaders });
    response.cookies.set(openAIDeviceCookieName(), "", { ...cookieOptions, maxAge: 0 });
    return response;
  }
}
