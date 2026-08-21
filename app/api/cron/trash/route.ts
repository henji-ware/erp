import { NextRequest } from "next/server";
import { purgeExpiredTrash } from "@/lib/trash";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET não configurado", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const removed = await purgeExpiredTrash();
  return Response.json({
    ok: true,
    removed,
    total: Object.values(removed).reduce((sum, count) => sum + count, 0),
  });
}

