import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { saveOAuthCredential } from "@/lib/ai/credentials";
import { exchangeOAuthCode, isOAuthProvider, oauthCookieName, oauthOrigin, OAUTH_TTL_SECONDS, startOAuth, validateOAuth } from "@/lib/ai/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ provider: string }> };
const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export async function POST(req: NextRequest, context: Context) {
  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Este provedor não oferece OAuth web nesta integração." }, { status: 400, headers: privateHeaders });
  try {
    if (req.headers.get("origin") !== oauthOrigin()) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403, headers: privateHeaders });
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const flow = startOAuth(provider, auth.user.id, req.cookies.get(SESSION_COOKIE)?.value || "");
    const response = NextResponse.json({ url: flow.url }, { headers: privateHeaders });
    response.cookies.set(oauthCookieName(provider), flow.cookie, { ...cookieOptions, maxAge: OAUTH_TTL_SECONDS });
    return response;
  } catch {
    return NextResponse.json({ error: "OAuth indisponível. Peça ao administrador para conferir APP_URL e a configuração do provedor." }, { status: 503, headers: privateHeaders });
  }
}

export async function GET(req: NextRequest, context: Context) {
  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Provedor não suportado." }, { status: 400, headers: privateHeaders });
  // Destino relativo fixo: nunca confia em Host, next, redirect_uri ou returnTo.
  const response = new NextResponse(null, { status: 303, headers: { ...privateHeaders, Location: `/settings?oauth=error&provider=${provider}#ia` } });
  response.cookies.set(oauthCookieName(provider), "", { ...cookieOptions, maxAge: 0 });
  try {
    const user = await getCurrentUser();
    if (!user) { response.headers.set("Location", "/login?error=session"); return response; }
    const pending = validateOAuth(req.cookies.get(oauthCookieName(provider))?.value, provider, user.id, req.cookies.get(SESSION_COOKIE)?.value || "", req.nextUrl.searchParams.get("state"));
    if (req.nextUrl.searchParams.has("error")) {
      response.headers.set("Location", `/settings?oauth=cancelled&provider=${provider}#ia`);
      return response;
    }
    const credential = await exchangeOAuthCode(pending, req.nextUrl.searchParams.get("code") || "");
    await saveOAuthCredential(user.id, credential);
    await logAudit({ action: "UPDATE", entity: "AICredential", summary: `Conectou ${provider} por OAuth` });
    response.headers.set("Location", `/settings?oauth=success&provider=${provider}#ia`);
  } catch {
    // Não registrar query, códigos, tokens nem respostas do provedor.
  }
  return response;
}
