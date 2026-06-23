import { PrismaClient } from "@prisma/client";

// Em serverless (Vercel) + pooler do Neon (PgBouncer), o Prisma precisa do
// parâmetro `pgbouncer=true` para não reaproveitar "prepared statements"
// entre conexões — senão dá exceção intermitente em algumas operações.
function runtimeUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("pgbouncer=")) return url;
  // Só faz sentido em conexão "pooled" (host com -pooler).
  if (!url.includes("-pooler")) return url;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reaproveita o cliente entre invocações (dev hot-reload e serverless quente).
globalForPrisma.prisma = prisma;
