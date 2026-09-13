import { timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto";
import { pkceChallenge, type OAuthCredential } from "./oauth";

export const OPENAI_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const OPENAI_DEVICE_TTL_SECONDS = 15 * 60;
export const OPENAI_DEVICE_VERIFICATION_URL = "https://auth.openai.com/codex/device";

const OPENAI_ISSUER = "https://auth.openai.com";
// ID público usado pelo Codex CLI no fluxo de dispositivo. Não é um segredo.
const OPENAI_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

interface PendingDeviceOAuth {
  purpose: "openai-device-oauth";
  userId: number;
  sessionHash: string;
  deviceAuthId: string;
  userCode: string;
  intervalSeconds: number;
  createdAt: number;
}

export interface OpenAIDeviceStart {
  cookie: string;
  verificationUrl: string;
  userCode: string;
  intervalSeconds: number;
}

export type OpenAIDevicePoll =
  | { status: "waiting"; intervalSeconds: number }
  | { status: "connected"; credential: OAuthCredential };

function validOpaque(value: unknown, max = 8192): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\s\x00-\x1f\x7f]/.test(value);
}

function validAccountId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value);
}

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function requestHeaders(contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "User-Agent": "drr-erp-crm/1.0",
  };
}

async function providerRequest(url: string, body: string, contentType: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: requestHeaders(contentType),
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
}

function parseJwtClaims(token: string): Record<string, any> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function accountIdFromToken(token: unknown): string | undefined {
  if (!validOpaque(token)) return undefined;
  const claims = parseJwtClaims(token);
  const auth = claims?.["https://api.openai.com/auth"];
  const value = claims?.chatgpt_account_id ?? auth?.chatgpt_account_id ?? claims?.organizations?.[0]?.id;
  return validAccountId(value) ? value : undefined;
}

function credentialFromTokens(data: Record<string, unknown>, previous?: OAuthCredential): OAuthCredential {
  if (!validOpaque(data.access_token)) throw new Error("A OpenAI devolveu uma credencial inválida.");
  const refreshToken = validOpaque(data.refresh_token) ? data.refresh_token : previous?.refreshToken;
  if (!validOpaque(refreshToken)) throw new Error("A OpenAI não concedeu acesso renovável. Conecte novamente.");
  const accountId = accountIdFromToken(data.id_token) || accountIdFromToken(data.access_token) || previous?.accountId;
  if (!validAccountId(accountId)) throw new Error("Não foi possível identificar a conta ChatGPT autorizada.");
  const expiresIn = typeof data.expires_in === "number" && Number.isFinite(data.expires_in) && data.expires_in > 0
    ? data.expires_in
    : 3600;
  return {
    provider: "openai",
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    accountId,
  };
}

export function openAIDeviceCookieName(): string {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}ai-openai-device`;
}

export async function startOpenAIDeviceOAuth(
  userId: number,
  session: string,
  now = Date.now(),
): Promise<OpenAIDeviceStart> {
  if (!session) throw new Error("Sessão inválida. Entre novamente.");
  const response = await providerRequest(
    `${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`,
    JSON.stringify({ client_id: OPENAI_CODEX_CLIENT_ID }),
    "application/json",
  );
  if (!response.ok) throw new Error("A OpenAI não iniciou a autorização. Tente novamente.");
  const data = await response.json() as Record<string, unknown>;
  if (!validOpaque(data.device_auth_id, 1024) || !validOpaque(data.user_code, 128)) {
    throw new Error("A OpenAI devolveu uma autorização inválida.");
  }
  const parsedInterval = typeof data.interval === "number" ? data.interval : Number.parseInt(String(data.interval), 10);
  const intervalSeconds = Math.min(30, Math.max(3, Number.isFinite(parsedInterval) ? parsedInterval : 5));
  const pending: PendingDeviceOAuth = {
    purpose: "openai-device-oauth",
    userId,
    sessionHash: pkceChallenge(session),
    deviceAuthId: data.device_auth_id,
    userCode: data.user_code,
    intervalSeconds,
    createdAt: now,
  };
  return {
    cookie: encryptSecret(JSON.stringify(pending)),
    verificationUrl: OPENAI_DEVICE_VERIFICATION_URL,
    userCode: pending.userCode,
    intervalSeconds,
  };
}

function readPending(cookie: string | undefined, userId: number, session: string, now: number): PendingDeviceOAuth {
  try {
    const value = JSON.parse(decryptSecret(cookie || "") || "null") as PendingDeviceOAuth;
    if (!value || value.purpose !== "openai-device-oauth" || value.userId !== userId || !session) throw new Error();
    if (!safeEqual(value.sessionHash, pkceChallenge(session))) throw new Error();
    if (!validOpaque(value.deviceAuthId, 1024) || !validOpaque(value.userCode, 128)) throw new Error();
    if (!Number.isFinite(value.createdAt) || now < value.createdAt || now - value.createdAt >= OPENAI_DEVICE_TTL_SECONDS * 1000) throw new Error();
    if (!Number.isFinite(value.intervalSeconds) || value.intervalSeconds < 1 || value.intervalSeconds > 30) throw new Error();
    return value;
  } catch {
    throw new Error("A autorização expirou. Inicie a conexão novamente.");
  }
}

export async function pollOpenAIDeviceOAuth(
  cookie: string | undefined,
  userId: number,
  session: string,
  now = Date.now(),
): Promise<OpenAIDevicePoll> {
  const pending = readPending(cookie, userId, session, now);
  const response = await providerRequest(
    `${OPENAI_ISSUER}/api/accounts/deviceauth/token`,
    JSON.stringify({ device_auth_id: pending.deviceAuthId, user_code: pending.userCode }),
    "application/json",
  );
  if (response.status === 403 || response.status === 404) {
    return { status: "waiting", intervalSeconds: pending.intervalSeconds };
  }
  if (!response.ok) throw new Error("A OpenAI recusou a autorização. Inicie novamente.");
  const authorization = await response.json() as Record<string, unknown>;
  if (!validOpaque(authorization.authorization_code) || !validOpaque(authorization.code_verifier)) {
    throw new Error("A OpenAI devolveu um código de autorização inválido.");
  }
  const tokenResponse = await providerRequest(
    `${OPENAI_ISSUER}/oauth/token`,
    new URLSearchParams({
      grant_type: "authorization_code",
      code: authorization.authorization_code,
      redirect_uri: `${OPENAI_ISSUER}/deviceauth/callback`,
      client_id: OPENAI_CODEX_CLIENT_ID,
      code_verifier: authorization.code_verifier,
    }).toString(),
    "application/x-www-form-urlencoded",
  );
  if (!tokenResponse.ok) throw new Error("Não foi possível concluir a conexão com a OpenAI.");
  return { status: "connected", credential: credentialFromTokens(await tokenResponse.json()) };
}

export async function refreshOpenAICredential(credential: OAuthCredential): Promise<OAuthCredential> {
  if (credential.provider !== "openai" || !validOpaque(credential.refreshToken)) {
    throw new Error("Reconecte sua conta ChatGPT.");
  }
  const response = await providerRequest(
    `${OPENAI_ISSUER}/oauth/token`,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_id: OPENAI_CODEX_CLIENT_ID,
    }).toString(),
    "application/x-www-form-urlencoded",
  );
  if (!response.ok) throw new Error("A sessão ChatGPT expirou. Reconecte sua conta.");
  return credentialFromTokens(await response.json(), credential);
}
