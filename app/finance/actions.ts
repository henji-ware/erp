"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHODS } from "@/lib/format";
import { deriveStatus, remaining } from "@/lib/finance";

export async function createTransaction(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!description || !["RECEIVABLE", "PAYABLE"].includes(type)) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(dueRaw) : new Date();

  await prisma.transaction.create({
    data: {
      description,
      type,
      amount: num(formData.get("amount")),
      dueDate,
      status: "PENDING",
      customerId: type === "RECEIVABLE" ? Number(formData.get("customerId")) || null : null,
      supplierId: type === "PAYABLE" ? Number(formData.get("supplierId")) || null : null,
    },
  });

  revalidatePath("/finance");
  revalidatePath("/");
}

export async function updateTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!id || !description || !["RECEIVABLE", "PAYABLE"].includes(type)) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  await prisma.transaction.update({
    where: { id },
    data: {
      description,
      type,
      amount: num(formData.get("amount")),
      dueDate: dueRaw ? new Date(dueRaw) : undefined,
      customerId: type === "RECEIVABLE" ? Number(formData.get("customerId")) || null : null,
      supplierId: type === "PAYABLE" ? Number(formData.get("supplierId")) || null : null,
    },
  });
  await recompute(id);

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
      method,
      paidAt: dateRaw ? new Date(dateRaw) : new Date(),
    },
  });
  await recompute(transactionId);

  revalidatePath("/finance");
  revalidatePath(`/finance/${transactionId}`);
  revalidatePath("/");
}

// Quita o valor restante de uma vez (forma de pagamento informada).
export async function payRemaining(formData: FormData) {
  const id = Number(formData.get("id"));
  const method = String(formData.get("method") ?? "CASH");
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
