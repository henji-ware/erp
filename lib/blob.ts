// Token do Vercel Blob. Quando o store é conectado com prefixo personalizado
// (ex.: store chamado "storage"), a Vercel injeta "storage_READ_WRITE_TOKEN"
// em vez do padrão BLOB_READ_WRITE_TOKEN — aceitamos qualquer um dos dois.
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN"));
  return key ? process.env[key] : undefined;
}
