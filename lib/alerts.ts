import { prisma } from "./prisma";
import { crmScope } from "./auth";
import { formatCurrency } from "./format";

export type AlertItem = {
  section: "Financeiro" | "Inspeções" | "Manutenção" | "Locações";
  href: string;
  label: string;
  date: Date;
  days: number; // negativo = vencido; 0 = hoje
};

export const ALERT_WINDOW_DAYS = 3;

// Diferença em dias corridos (ignora horas).
function diffDays(date: Date, now: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Texto curto de prazo: "faltam 3 dias", "vence hoje", "venceu há 2 dias".
export function alertText(days: number): string {
  if (days < 0) return `venceu há ${-days} dia${-days > 1 ? "s" : ""}`;
  if (days === 0) return "vence hoje";
  if (days === 1) return "falta 1 dia";
  return `faltam ${days} dias`;
}

// Prazos próximos/vencidos visíveis ao usuário (mesma regra do e-mail diário).
export async function getAlerts(
  user: { id: number; role: string } | null | undefined,
): Promise<AlertItem[]> {
  const now = new Date();
  const until = new Date(now.getTime() + ALERT_WINDOW_DAYS * 86400000);
  const scope = crmScope(user);

  const [txs, inspections, maint, rentals] = await Promise.all([
    prisma.transaction.findMany({
      where: { deletedAt: null, status: { not: "PAID" }, dueDate: { lte: until }, ...scope },
      orderBy: { dueDate: "asc" },
    }),
    prisma.inspection.findMany({
      where: { deletedAt: null, status: "AGENDADA", scheduledAt: { lte: until }, ...scope },
      include: { customer: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.maintenanceContract.findMany({
      where: { deletedAt: null, status: "ACTIVE", nextVisit: { lte: until }, ...scope },
      include: { customer: true },
      orderBy: { nextVisit: "asc" },
    }),
    prisma.rental.findMany({
      where: { deletedAt: null, status: "ACTIVE", expectedEnd: { lte: until }, ...scope },
      include: { customer: true, product: true },
      orderBy: { expectedEnd: "asc" },
    }),
  ]);

  const items: AlertItem[] = [
    ...txs.map((t) => ({
      section: "Financeiro" as const,
      href: `/finance/${t.id}`,
      label: `${t.type === "RECEIVABLE" ? "A receber" : "A pagar"}: ${t.description} — ${formatCurrency(t.amount)}`,
      date: t.dueDate,
      days: diffDays(t.dueDate, now),
    })),
    ...inspections.map((i) => ({
      section: "Inspeções" as const,
      href: `/inspections/${i.id}`,
      label: `Inspeção — ${i.customer.name}`,
      date: i.scheduledAt,
      days: diffDays(i.scheduledAt, now),
    })),
    ...maint.map((m) => ({
      section: "Manutenção" as const,
      href: "/maintenance",
      label: `${m.title} — ${m.customer.name}`,
      date: m.nextVisit!,
      days: diffDays(m.nextVisit!, now),
    })),
    ...rentals.map((r) => ({
      section: "Locações" as const,
      href: "/rentals",
      label: `Devolução: ${r.product.name} — ${r.customer.name}`,
      date: r.expectedEnd!,
      days: diffDays(r.expectedEnd!, now),
    })),
  ];

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
