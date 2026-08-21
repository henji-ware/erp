"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, PAYMENT_METHODS, TX_TYPES } from "@/lib/format";
import { deriveStatus, remaining } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditRecord } from "@/lib/auth";
import { parseMoney, roundMoney, splitMoney } from "@/lib/money";

// Autorização: só o dono (ou admin) altera o lançamento.
async function allowed(id: number): Promise<boolean> {
  return canEditRecord(
    await prisma.transaction.findUnique({ where: { id }, select: { ownerId: true } }),
  );
}

export async function createTransaction(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!description || !TX_TYPES.includes(type as (typeof TX_TYPES)[number])) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(dueRaw) : new Date();

  const user = await getCurrentUser();
  const total = num(formData.get("amount"));
  // Parcelamento: UM lançamento com N parcelas (1 = à vista, sem parcelas).
  const parts = Math.min(60, Math.max(1, int(formData.get("installments"))));

  const tx = await prisma.transaction.create({
    data: {
      description,
      type: asEnum(TX_TYPES, type, "RECEIVABLE"),
      amount: total,
      dueDate,
      status: "PENDING",
      customerId: type === "RECEIVABLE" ? Number(formData.get("customerId")) || null : null,
      supplierId: type === "PAYABLE" ? Number(formData.get("supplierId")) || null : null,
      ownerId: user?.id ?? null,
    },
  });

  if (parts > 1) {
    const amounts = splitMoney(total, parts);
    await prisma.installment.createMany({
      data: Array.from({ length: parts }, (_, i) => {
        const due = new Date(dueDate);
        due.setMonth(due.getMonth() + i);
        return {
          transactionId: tx.id,
          number: i + 1,
          amount: amounts[i],
          dueDate: due,
        };
      }),
    });
  }

  await logAudit({
    action: "CREATE",
    entity: "Financeiro",
    entityId: tx.id,
    summary:
      parts > 1
        ? `Lançamento "${description}" criado em ${parts}x`
        : `Lançamento "${description}" criado`,
  });

  revalidatePath("/finance");
  revalidatePath("/");
}

export async function updateTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!id || !description || !TX_TYPES.includes(type as (typeof TX_TYPES)[number])) return;
  if (!(await allowed(id))) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  // Com parcelas, valor e vencimento ficam desabilitados no formulário e o
  // navegador não os envia. Sem esta checagem o valor do lançamento seria
  // gravado como 0 ao editar só a descrição.
  const amountRaw = formData.get("amount");

  await prisma.transaction.update({
    where: { id },
    data: {
      description,
      type: asEnum(TX_TYPES, type, "RECEIVABLE"),
      ...(amountRaw === null ? {} : { amount: num(amountRaw) }),
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
  if (!(await allowed(transactionId))) return;

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
  if (!(await allowed(id))) return;

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
  if (!(await allowed(payment.transactionId))) return;

  await prisma.payment.delete({ where: { id } });
  await recompute(payment.transactionId);

  revalidatePath("/finance");
  revalidatePath(`/finance/${payment.transactionId}`);
  revalidatePath("/");
}

export async function deleteTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await allowed(id))) return;
  // Soft delete: vai para a Lixeira (recuperável); pagamentos são preservados.
  await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Financeiro", entityId: id, summary: "Lançamento arquivado" });
  revalidatePath("/finance");
  revalidatePath("/");
}

// ---- Parcelas ----

// Gera (ou regera) o cronograma: N parcelas mensais a partir do 1º vencimento.
// As parcelas anteriores são substituídas; pagamentos já feitos são mantidos.
export async function generateInstallments(formData: FormData) {
  const transactionId = Number(formData.get("transactionId"));
  const count = Math.min(60, Math.max(1, int(formData.get("count"))));
  const firstRaw = String(formData.get("firstDue") ?? "");
  if (!transactionId) return;
  if (!(await allowed(transactionId))) return;

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) return;

  const first = firstRaw ? new Date(firstRaw) : new Date(tx.dueDate);
  const amounts = splitMoney(tx.amount, count);

  await prisma.installment.deleteMany({ where: { transactionId } });
  await prisma.installment.createMany({
    data: Array.from({ length: count }, (_, i) => {
      const due = new Date(first);
      due.setMonth(due.getMonth() + i);
      return {
        transactionId,
        number: i + 1,
        amount: amounts[i],
        dueDate: due,
      };
    }),
  });

  // O 1º vencimento do lançamento acompanha a 1ª parcela.
  await prisma.transaction.update({ where: { id: transactionId }, data: { dueDate: first } });
  await logAudit({ action: "UPDATE", entity: "Financeiro", entityId: transactionId, summary: `Parcelado em ${count}x` });

  revalidatePath(`/finance/${transactionId}`);
  revalidatePath("/finance");
}

// Edita uma parcela (valor e/ou vencimento) e ajusta o total do lançamento.
export async function updateInstallment(formData: FormData) {
  const id = Number(formData.get("installmentId"));
  if (!id) return;
  const inst = await prisma.installment.findUnique({ where: { id } });
  if (!inst || !(await allowed(inst.transactionId))) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  const amountRaw = formData.get("amount");
  await prisma.installment.update({
    where: { id },
    data: {
      // Parcela quitada tem os campos desabilitados: sem valor enviado,
      // mantém o que está gravado em vez de zerar.
      ...(amountRaw === null ? {} : { amount: num(amountRaw) }),
      ...(dueRaw ? { dueDate: new Date(dueRaw) } : {}),
    },
  });
  await syncFromInstallments(inst.transactionId);

  revalidatePath(`/finance/${inst.transactionId}`);
  revalidatePath("/finance");
}

// Acrescenta uma parcela ao fim do cronograma (mês seguinte à última).
export async function addInstallment(formData: FormData) {
  const transactionId = Number(formData.get("transactionId"));
  if (!transactionId) return;
  if (!(await allowed(transactionId))) return;

  const last = await prisma.installment.findFirst({
    where: { transactionId },
    orderBy: { number: "desc" },
  });
  const due = new Date(last?.dueDate ?? new Date());
  if (last) due.setMonth(due.getMonth() + 1);

  await prisma.installment.create({
    data: {
      transactionId,
      number: (last?.number ?? 0) + 1,
      amount: 0,
      dueDate: due,
    },
  });
  await syncFromInstallments(transactionId);

  revalidatePath(`/finance/${transactionId}`);
}

export async function deleteInstallment(formData: FormData) {
  const id = Number(formData.get("installmentId"));
  if (!id) return;
  const inst = await prisma.installment.findUnique({ where: { id } });
  if (!inst || !(await allowed(inst.transactionId))) return;

  await prisma.installment.delete({ where: { id } });
  await renumberInstallments(inst.transactionId);
  await syncFromInstallments(inst.transactionId);

  revalidatePath(`/finance/${inst.transactionId}`);
  revalidatePath("/finance");
}

// Quita uma parcela (registra o pagamento vinculado a ela).
export async function payInstallment(formData: FormData) {
  const id = Number(formData.get("installmentId"));
  const method = asEnum(PAYMENT_METHODS, formData.get("method"), "PIX");
  if (!id) return;

  const inst = await prisma.installment.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!inst || !(await allowed(inst.transactionId))) return;

  const alreadyPaid = inst.payments.reduce((s, p) => s + p.amount, 0);
  const left = roundMoney(inst.amount - alreadyPaid);
  if (left <= 0) return;

  await prisma.payment.create({
    data: { transactionId: inst.transactionId, installmentId: id, amount: left, method },
  });
  await recompute(inst.transactionId);
  await logAudit({ action: "UPDATE", entity: "Financeiro", entityId: inst.transactionId, summary: `Parcela ${inst.number} quitada` });

  revalidatePath(`/finance/${inst.transactionId}`);
  revalidatePath("/finance");
  revalidatePath("/");
}

// Remove o parcelamento (volta a lançamento à vista).
export async function clearInstallments(formData: FormData) {
  const transactionId = Number(formData.get("transactionId"));
  if (!transactionId) return;
  if (!(await allowed(transactionId))) return;
  await prisma.installment.deleteMany({ where: { transactionId } });
  revalidatePath(`/finance/${transactionId}`);
  revalidatePath("/finance");
}

// Mantém a numeração 1..N contínua após remoções.
async function renumberInstallments(transactionId: number) {
  const list = await prisma.installment.findMany({
    where: { transactionId },
    orderBy: { dueDate: "asc" },
  });
  await Promise.all(
    list.map((it, i) =>
      it.number === i + 1
        ? Promise.resolve(it)
        : prisma.installment.update({ where: { id: it.id }, data: { number: i + 1 } }),
    ),
  );
}

// Com parcelas, o valor do lançamento é a soma delas (e o venc. é o da 1ª).
async function syncFromInstallments(transactionId: number) {
  const list = await prisma.installment.findMany({
    where: { transactionId },
    orderBy: { dueDate: "asc" },
  });
  if (list.length === 0) return;
  const total = roundMoney(list.reduce((s, it) => s + it.amount, 0));
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { amount: total, dueDate: list[0].dueDate },
  });
  await recompute(transactionId);
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
  return parseMoney(v);
}
function int(v: FormDataEntryValue | null): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 1;
}
