import { headers } from "next/headers";

// URL base da aplicação, para montar links absolutos nos e-mails.
// Usa APP_URL se definido; senão deriva dos cabeçalhos da requisição.
export async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
