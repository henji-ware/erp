"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, PAYMENT_METHODS, TX_TYPES } from "@/lib/format";
import { deriveStatus, remaining } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";

export async function createTransaction(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!description || !TX_TYPES.includes(type as (typeof TX_TYPES)[number])) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(dueRaw) : new Date();

  const user = await getCurrentUser();
  const tx = await prisma.transaction.create({
    data: {
      description,
      type: asEnum(TX_TYPES, type, "RECEIVABLE"),
      amount: num(formData.get("amount")),
      dueDate,
      status: "PENDING",
      customerId: type === "RECEIVABLE" ? Number(formData.get("customerId")) || null : null,
      supplierId: type === "PAYABLE" ? Number(formData.get("supplierId")) || null : null,
      ownerId: user?.id ?? null,
    },
  });
  await logAudit({ action: "CREATE", entity: "Financeiro", entityId: tx.id, summary: `Lançamento "${description}" criado` });

  revalidatePath("/finance");
  revalidatePath("/");
}

export async function updateTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!id || !description || !TX_TYPES.includes(type as (typeof TX_TYPES)[number])) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  await prisma.transaction.update({
    where: { id },
    data: {
      description,
      type: asEnum(TX_TYPES, type, "RECEIVABLE"),
      amount: num(formData.get("amount")),
      dueDate: dueRaw ? new Date(dueRaw) : undefined,
      customerId: type === "RECEIVABLE" ? Number(formData.get("customerId")) || null : null,
      supplierId: type === "PAYABLE" ? Number(formData.get("supplierId")) || null : null,
    },
  });
  await recompute(id);
  await logAudit({ action: "UPDATE", entity: "Financeiro", entityId: id, summary: `Lançamento "${description}" editado` });

  revalidatePath("/finance");
  revalidatePath("/");
  redirect(`/finance/${id}`);
}

// Registra um pagamento (pode ser parcial) com forma de pagamento.
export async function addPayment(formData: FormData) {
  const transactionId = Number(formData.get("transactionId"));
  const amount = num(formData.get("amount"));
  const method = String(formData.get("method") ?? "CASH");
  const dateRaw = String(formData.get("paidAt") ?? "");
  if (!transactionId || amount <= 0) return;
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) return;

  await prisma.payment.create({
    data: {
      transactionId,
      amount,
      method: asEnum(PAYMENT_METHODS, method, "CASH"),
      paidAt: dateRaw ? new Date(dateRaw) : new Date(),
    },
  });
  await recompute(transactionId);
  await logAudit({ action: "UPDATE", entity: "Financeiro", entityId: transactionId, summary: "Pagamento registrado" });

  revalidatePath("/finance");
  revalidatePath(`/finance/${transactionId}`);
  revalidatePath("/");
}

// Quita o valor restante de uma vez (forma de pagamento informada).
export async function payRemaining(formData: FormData) {
  const id = Number(formData.get("id"));
  const method = asEnum(PAYMENT_METHODS, formData.get("method"), "CASH");
  if (!id) return;

  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!tx) return;
  const left = remaining(tx);
  if (left <= 0) return;

  await prisma.payment.create({
    data: { transactionId: id, amount: left, method },
  });
  await recompute(id);
  await logAudit({ action: "UPDATE", entity: "Financeiro", entityId: id, summary: "Quitação registrada" });

  revalidatePath("/finance");
  revalidatePath(`/finance/${id}`);
  revalidatePath("/");
}

export async function deletePayment(formData: FormData) {
  const id = Number(formData.get("paymentId"));
  if (!id) return;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return;

  await prisma.payment.delete({ where: { id } });
  await recompute(payment.transactionId);

  revalidatePath("/finance");
  revalidatePath(`/finance/${payment.transactionId}`);
  revalidatePath("/");
}

export async function deleteTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.transaction.delete({ where: { id } }); // pagamentos em cascata
  await logAudit({ action: "DELETE", entity: "Financeiro", entityId: id, summary: "Lançamento excluído" });
  revalidatePath("/finance");
  revalidatePath("/");
}

// Recalcula o status (PENDING/PARTIAL/PAID) a partir dos pagamentos.
async function recompute(transactionId: number) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { payments: true },
  });
  if (!tx) return;
  const paid = tx.payments.reduce((s, p) => s + p.amount, 0);
  const status = deriveStatus(tx.amount, paid);
  if (status !== tx.status) {
    await prisma.transaction.update({ where: { id: transactionId }, data: { status } });
  }
}

function num(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
