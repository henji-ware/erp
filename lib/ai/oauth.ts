import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { canStoreSecrets, decryptSecret, encryptSecret } from "./crypto";

export type OAuthProvider = "openrouter" | "gemini";
export const OAUTH_TTL_SECONDS = 600;
export const GOOGLE_AI_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const PAYLOAD_PREFIX = "drr-ai-oauth-v1:";

export interface OAuthCredential {
  provider: OAuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  quotaProject?: string;
}

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === "openrouter" || value === "gemini";
}

export function oauthOrigin(): string {
  const url = new URL(process.env.APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : ""));
  const local = process.env.NODE_ENV !== "production" && url.hostname === "localhost";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Configure APP_URL com a origem HTTPS pública do ERP, sem caminho.");
  }
  return url.origin;
}

function googleConfig() {
  const clientId = process.env.GOOGLE_AI_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_AI_OAUTH_CLIENT_SECRET?.trim();
  const quotaProject = process.env.GOOGLE_AI_PROJECT_ID?.trim();
  if (!clientId || !clientSecret || !quotaProject || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(quotaProject)) {
    throw new Error("OAuth Google não configurado no servidor.");
  }
  return { clientId, clientSecret, quotaProject };
}

export function oauthAvailability(): Record<OAuthProvider, boolean> {
  let base = false;
  try { oauthOrigin(); base = canStoreSecrets(); } catch { /* origem ausente */ }
  let google = false;
  try { googleConfig(); google = base; } catch { /* configuração opcional */ }
  return { openrouter: base, gemini: google };
}

export function oauthCookieName(provider: OAuthProvider): string {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}ai-oauth-${provider}`;
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

interface PendingOAuth {
  purpose: "ai-oauth";
  provider: OAuthProvider;
  userId: number;
  sessionHash: string;
  state: string;
  verifier: string;
  createdAt: number;
  callback: string;
}

export function startOAuth(provider: OAuthProvider, userId: number, session: string, now = Date.now()) {
  if (!oauthAvailability()[provider] || !session) throw new Error("OAuth indisponível. Verifique a configuração do servidor.");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const callback = new URL(`/api/ai/oauth/${provider}`, oauthOrigin());
  const url = new URL(provider === "openrouter" ? "https://openrouter.ai/auth" : "https://accounts.google.com/o/oauth2/v2/auth");
  if (provider === "openrouter") {
    // OpenRouter preserva os parâmetros do callback, inclusive state.
    callback.searchParams.set("state", state);
    url.searchParams.set("callback_url", callback.href);
  } else {
    url.searchParams.set("client_id", googleConfig().clientId);
    url.searchParams.set("redirect_uri", callback.href);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_AI_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
  }
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  const pending: PendingOAuth = { purpose: "ai-oauth", provider, userId, sessionHash: pkceChallenge(session), state, verifier, createdAt: now, callback: callback.href };
  return { url: url.href, cookie: encryptSecret(JSON.stringify(pending)) };
}

export function validateOAuth(cookie: string | undefined, provider: OAuthProvider, userId: number, session: string, state: string | null, now = Date.now()): PendingOAuth {
  try {
    const pending = JSON.parse(decryptSecret(cookie || "") || "null") as PendingOAuth;
    if (!pending || pending.purpose !== "ai-oauth" || pending.provider !== provider || pending.userId !== userId) throw new Error();
    if (!session || pending.sessionHash !== pkceChallenge(session)) throw new Error();
    if (!state || typeof pending.state !== "string" || state.length !== pending.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(pending.state))) throw new Error();
    if (!Number.isFinite(pending.createdAt) || now < pending.createdAt || now - pending.createdAt >= OAUTH_TTL_SECONDS * 1000) throw new Error();
    return pending;
  } catch {
    throw new Error("Autorização expirada ou inválida. Inicie a conexão novamente.");
  }
}

export function encodeOAuthCredential(credential: OAuthCredential): string {
  return PAYLOAD_PREFIX + JSON.stringify(credential);
}

export function decodeOAuthCredential(value: string): OAuthCredential | null {
  if (!value.startsWith(PAYLOAD_PREFIX)) return null;
  try {
    const data = JSON.parse(value.slice(PAYLOAD_PREFIX.length));
    if (!isOAuthProvider(data.provider) || !validToken(data.accessToken) || (data.refreshToken !== undefined && !validToken(data.refreshToken)) || (data.provider === "gemini" && (!Number.isFinite(data.expiresAt) || typeof data.quotaProject !== "string"))) throw new Error();
    return data;
  } catch {
    throw new Error("Credencial OAuth inválida. Reconecte sua conta.");
  }
}

function validToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 8192 && !/[\s\x00-\x1f\x7f]/.test(value);
}

async function tokenRequest(url: string, body: string | URLSearchParams) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": typeof body === "string" ? "application/json" : "application/x-www-form-urlencoded" },
    body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  // Nunca devolva o corpo de erro: pode conter código ou token.
  if (!response.ok) throw new Error("O provedor recusou a autorização. Reconecte sua conta.");
  return response.json();
}

function googleTokens(data: Record<string, unknown>, refreshToken?: string): OAuthCredential {
  if (!validToken(data.access_token) || data.token_type !== "Bearer" || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error("Resposta OAuth inválida do Google.");
  if (data.scope !== undefined && (typeof data.scope !== "string" || !data.scope.split(" ").includes(GOOGLE_AI_SCOPE))) throw new Error("A permissão necessária para usar o Gemini não foi concedida.");
  const refresh = data.refresh_token ?? refreshToken;
  if (!validToken(refresh)) throw new Error("O Google não concedeu acesso offline. Reconecte a conta e autorize o acesso.");
  return { provider: "gemini", accessToken: data.access_token, refreshToken: refresh, expiresAt: Date.now() + data.expires_in * 1000, quotaProject: googleConfig().quotaProject };
}

export async function exchangeOAuthCode(pending: PendingOAuth, code: string): Promise<OAuthCredential> {
  if (!validToken(code)) throw new Error("Código OAuth inválido.");
  if (pending.provider === "openrouter") {
    const data = await tokenRequest("https://openrouter.ai/api/v1/auth/keys", JSON.stringify({ code, code_verifier: pending.verifier, code_challenge_method: "S256" }));
    if (!validToken(data.key)) throw new Error("Resposta OAuth inválida do OpenRouter.");
    return { provider: "openrouter", accessToken: data.key };
  }
  const config = googleConfig();
  return googleTokens(await tokenRequest("https://oauth2.googleapis.com/token", new URLSearchParams({ code, code_verifier: pending.verifier, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: pending.callback, grant_type: "authorization_code" })));
}

export async function refreshGoogleCredential(credential: OAuthCredential): Promise<OAuthCredential> {
  if (credential.provider !== "gemini" || !credential.refreshToken) throw new Error("Reconecte sua conta Google.");
  const config = googleConfig();
  const next = googleTokens(await tokenRequest("https://oauth2.googleapis.com/token", new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: credential.refreshToken, grant_type: "refresh_token" })), credential.refreshToken);
  return { ...next, quotaProject: credential.quotaProject };
}
