// Assinatura/verificação de token de sessão usando Web Crypto.
// Sem imports de Node => seguro para usar no middleware (edge) e no servidor.

const SECRET =
  process.env.SESSION_SECRET || "dev-insecure-secret-change-me-in-production";

const encoder = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
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

// Token = "<payload>.<hmacHex>". payload = userId.
export async function signToken(payload: string): Promise<string> {
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
  try {
    const key = await getKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      hexToBuf(sigHex) as BufferSource,
      encoder.encode(payload),
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session";
