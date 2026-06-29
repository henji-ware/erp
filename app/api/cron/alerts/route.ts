import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailLayout, isEmailConfigured } from "@/lib/email";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Avisa quando algo vence nos próximos dias (ou já venceu).
const ALERT_DAYS = 3;

type Item = {
  ownerId: number | null;
  kind: string;
  label: string;
  date: Date;
  overdue: boolean;
};

export async function GET(req: NextRequest) {
  // Proteção: o Vercel Cron envia "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isEmailConfigured()) {
    return Response.json({ ok: false, reason: "RESEND_API_KEY ausente" });
  }

  const now = new Date();
  const until = new Date(now.getTime() + ALERT_DAYS * 86400000);

  const [txs, inspections, maint, rentals, users] = await Promise.all([
    prisma.transaction.findMany({ where: { status: { not: "PAID" }, dueDate: { lte: until } } }),
    prisma.inspection.findMany({ where: { status: "AGENDADA", scheduledAt: { lte: until } }, include: { customer: true } }),
    prisma.maintenanceContract.findMany({ where: { status: "ACTIVE", nextVisit: { lte: until } }, include: { customer: true } }),
    prisma.rental.findMany({ where: { status: "ACTIVE", expectedEnd: { lte: until } }, include: { customer: true, product: true } }),
    prisma.user.findMany({ where: { active: true } }),
  ]);

  const items: Item[] = [];
  for (const t of txs)
    items.push({ ownerId: t.ownerId, kind: t.type === "RECEIVABLE" ? "A receber" : "A pagar", label: `${t.description} — ${formatCurrency(t.amount)}`, date: t.dueDate, overdue: t.dueDate < now });
  for (const i of inspections)
    items.push({ ownerId: i.ownerId, kind: "Inspeção", label: i.customer.name, date: i.scheduledAt, overdue: i.scheduledAt < now });
  for (const m of maint)
    items.push({ ownerId: m.ownerId, kind: "Manutenção", label: `${m.title} — ${m.customer.name}`, date: m.nextVisit!, overdue: m.nextVisit! < now });
  for (const r of rentals)
    items.push({ ownerId: r.ownerId, kind: "Locação", label: `${r.product.name} — ${r.customer.name}`, date: r.expectedEnd!, overdue: r.expectedEnd! < now });

  let sent = 0;
  for (const u of users) {
    // Admin recebe tudo; usuário comum recebe só o que é dele.
    const mine = u.role === "ADMIN" ? items : items.filter((it) => it.ownerId === u.id);
    if (mine.length === 0) continue;

    mine.sort((a, b) => a.date.getTime() - b.date.getTime());
    const rows = mine
      .map(
        (it) =>
          `<li style="margin-bottom:6px;"><strong>${it.kind}:</strong> ${it.label} — ${
            it.overdue
              ? `<span style="color:#dc2626;">venceu ${formatDate(it.date)}</span>`
              : `vence ${formatDate(it.date)}`
          }</li>`,
      )
      .join("");

    const okSent = await sendEmail({
      to: u.email,
      subject: `Você tem ${mine.length} prazo(s) próximo(s) — DRR Projetos`,
      html: emailLayout(
        "Prazos a vencer",
        `<p>Olá ${u.name}, estes itens vencem em até ${ALERT_DAYS} dias (ou já venceram):</p>
         <ul style="padding-left:18px;margin:12px 0;">${rows}</ul>`,
      ),
    });
    if (okSent) sent++;
  }

  return Response.json({ ok: true, items: items.length, emails: sent });
}
