// Assinatura/verificação de token de sessão usando Web Crypto.
// Sem imports de Node => seguro para usar no middleware (edge) e no servidor.

const SECRET = process.env.SESSION_SECRET;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

const encoder = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  if (!SECRET && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET precisa estar configurado em produção");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET || "dev-insecure-secret-change-me"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

// Token = "v1.<userId>.<issuedAt>.<hmacHex>". A data faz a expiração ser
// validada no servidor, mesmo que alguém tente reutilizar um cookie já vencido.
export async function signToken(userId: string): Promise<string> {
  if (!/^[1-9]\d*$/.test(userId)) throw new Error("ID de sessão inválido");
  const payload = `v1.${userId}.${Math.floor(Date.now() / 1000)}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bufToHex(sig)}`;
}

export async function verifyToken(
  token: string | undefined | null,
): Promise<string | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sigHex = token.slice(i + 1);
  // HMAC-SHA256 em hexadecimal tem exatamente 64 caracteres. Rejeitamos
  // formato, data futura e sessão vencida antes de consultar o banco.
  const match = /^v1\.([1-9]\d*)\.([1-9]\d*)$/.exec(payload);
  if (!match || !/^[0-9a-f]{64}$/i.test(sigHex)) return null;
  const issuedAt = Number(match[2]);
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + MAX_CLOCK_SKEW_SECONDS || now - issuedAt > SESSION_MAX_AGE_SECONDS) {
    return null;
  }
  try {
    const key = await getKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      hexToBuf(sigHex) as BufferSource,
      encoder.encode(payload),
    );
    return ok ? match[1] : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session";
