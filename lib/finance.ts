// Helpers de pagamentos parciais.

import { roundMoney } from "./money";

type WithPayments = { amount: number; payments?: { amount: number }[] };

export function paidAmount(tx: WithPayments): number {
  return (tx.payments ?? []).reduce((s, p) => s + p.amount, 0);
}

export function remaining(tx: WithPayments): number {
  return Math.max(0, round2(tx.amount - paidAmount(tx)));
}

// Status derivado a partir do total pago.
export function deriveStatus(
  amount: number,
  paid: number,
): "PENDING" | "PARTIAL" | "PAID" {
  if (paid <= 0.0001) return "PENDING";
  if (paid + 0.0001 >= amount) return "PAID";
  return "PARTIAL";
}

export function round2(n: number): number {
  return roundMoney(n);
}

// Situação de vencimento (para a "agenda" de pagamentos/recebimentos).
export function dueInfo(
  due: Date,
  status: string,
): { text: string; cls: string; overdue: boolean } | null {
  if (status === "PAID") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const plural = (n: number) => (n > 1 ? "s" : "");

  if (days < 0)
    return { text: `vencido há ${-days} dia${plural(-days)}`, cls: "text-red-600 font-medium", overdue: true };
  if (days === 0) return { text: "vence hoje", cls: "text-red-600 font-medium", overdue: true };
  if (days <= 7)
    return { text: `vence em ${days} dia${plural(days)}`, cls: "text-amber-600", overdue: false };
  return { text: `vence em ${days} dias`, cls: "text-slate-400", overdue: false };
}
