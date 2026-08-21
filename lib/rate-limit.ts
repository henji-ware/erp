import { headers } from "next/headers";
import { consumeBucket, type RateLimitResult } from "./rate-limit-core";

const globalBuckets = globalThis as typeof globalThis & {
  __rateLimitBuckets?: Map<string, { count: number; resetAt: number }>;
};

const buckets = globalBuckets.__rateLimitBuckets ?? new Map();
globalBuckets.__rateLimitBuckets = buckets;

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  // Evita crescimento indefinido em processos que ficam quentes por muito
  // tempo. A limpeza é barata e só ocorre quando o mapa passa de 1.000 chaves.
  if (buckets.size > 1000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return consumeBucket(buckets, key, limit, windowMs, now);
}

export async function requestIdentity(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || store.get("x-real-ip") || "unknown";
}
