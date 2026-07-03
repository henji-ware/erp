import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailLayout, isEmailConfigured } from "@/lib/email";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Avisa faltando 3, 2 e 1 dia, no dia do vencimento e enquanto estiver vencido.
const ALERT_DAYS = 3;

type Item = {
  ownerId: number | null;
  section: "Financeiro" | "Inspeções" | "Manutenção" | "Locações";
  label: string;
  date: Date;
};

// "faltam 3 dias" / "falta 1 dia" / "vence HOJE" / "venceu há X dia(s)"
function dayLabel(date: Date, now: Date): { text: string; color: string } {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((d1.getTime() - d0.getTime()) / 86400000);
  if (days < 0)
    return {
      text: `venceu ${formatDate(date)} — há ${-days} dia${-days > 1 ? "s" : ""}`,
      color: "#dc2626",
    };
  if (days === 0) return { text: "vence HOJE", color: "#dc2626" };
  if (days === 1) return { text: `falta 1 dia (${formatDate(date)})`, color: "#d97706" };
  return { text: `faltam ${days} dias (${formatDate(date)})`, color: "#d97706" };
}

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
    prisma.transaction.findMany({ where: { deletedAt: null, status: { not: "PAID" }, dueDate: { lte: until } } }),
    prisma.inspection.findMany({ where: { deletedAt: null, status: "AGENDADA", scheduledAt: { lte: until } }, include: { customer: true } }),
    prisma.maintenanceContract.findMany({ where: { deletedAt: null, status: "ACTIVE", nextVisit: { lte: until } }, include: { customer: true } }),
    prisma.rental.findMany({ where: { deletedAt: null, status: "ACTIVE", expectedEnd: { lte: until } }, include: { customer: true, product: true } }),
    prisma.user.findMany({ where: { active: true } }),
  ]);

  const items: Item[] = [];
  for (const t of txs)
    items.push({
      ownerId: t.ownerId,
      section: "Financeiro",
      label: `${t.type === "RECEIVABLE" ? "A receber" : "A pagar"}: ${t.description} — ${formatCurrency(t.amount)}`,
      date: t.dueDate,
    });
  for (const i of inspections)
    items.push({ ownerId: i.ownerId, section: "Inspeções", label: `Inspeção — ${i.customer.name}`, date: i.scheduledAt });
  for (const m of maint)
    items.push({ ownerId: m.ownerId, section: "Manutenção", label: `${m.title} — ${m.customer.name}`, date: m.nextVisit! });
  for (const r of rentals)
    items.push({ ownerId: r.ownerId, section: "Locações", label: `Devolução: ${r.product.name} — ${r.customer.name}`, date: r.expectedEnd! });

  const SECTION_ORDER: Item["section"][] = ["Financeiro", "Inspeções", "Manutenção", "Locações"];

  let sent = 0;
  for (const u of users) {
    // Admin recebe tudo; usuário comum recebe só o que é dele.
    const mine = u.role === "ADMIN" ? items : items.filter((it) => it.ownerId === u.id);
    if (mine.length === 0) continue;

    mine.sort((a, b) => a.date.getTime() - b.date.getTime());
    const sections = SECTION_ORDER.filter((s) => mine.some((it) => it.section === s));

    // Corpo agrupado por seção de origem.
    const groups = sections
      .map((s) => {
        const rows = mine
          .filter((it) => it.section === s)
          .map((it) => {
            const d = dayLabel(it.date, now);
            return `<li style="margin-bottom:6px;">${it.label} — <strong style="color:${d.color};">${d.text}</strong></li>`;
          })
          .join("");
        return `<p style="margin:14px 0 6px;font-weight:bold;color:#0f172a;">${s}</p><ul style="padding-left:18px;margin:0;">${rows}</ul>`;
      })
      .join("");

    const okSent = await sendEmail({
      to: u.email,
      subject: `Você tem ${mine.length} prazo(s) próximo(s) — DRR Projetos`,
      html: emailLayout(
        "Prazos a vencer",
        `<p>Olá ${u.name}, estes itens estão perto do prazo (ou já venceram):</p>${groups}`,
        sections.join(" · "),
      ),
    });
    if (okSent) sent++;
  }

  return Response.json({ ok: true, items: items.length, emails: sent });
}
