"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { asEnum, ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";

const ACTIVE = ["CONFIRMED", "INVOICED"];

export async function createOrder(formData: FormData) {
  const customerId = Number(formData.get("customerId"));
  if (!customerId) return;

  const status = asEnum(ORDER_STATUSES, formData.get("status"), "DRAFT");

  const productIds = formData.getAll("productId").map((v) => Number(v));
  const quantities = formData.getAll("quantity").map((v) => parseInt(String(v), 10));

  // Monta as linhas do pedido a partir dos produtos válidos.
  const products = await prisma.product.findMany({
    where: { id: { in: productIds.filter((n) => n > 0) } },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.price]));

  const items: { productId: number; quantity: number; unitPrice: number }[] = [];
  let total = 0;
  productIds.forEach((pid, i) => {
    const qty = quantities[i];
    if (pid > 0 && qty > 0 && priceMap.has(pid)) {
      const unitPrice = priceMap.get(pid)!;
      items.push({ productId: pid, quantity: qty, unitPrice });
      total += unitPrice * qty;
    }
  });

  if (items.length === 0) return;

  const sellerId = Number(formData.get("sellerId")) || null;
  const user = await getCurrentUser();

  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim() || null;

  const order = await prisma.order.create({
    data: {
      number: "PED-" + Date.now().toString(36).toUpperCase(),
      customerId,
      sellerId,
      status: "DRAFT",
      total,
      deliveryAddress,
      refCode: String(formData.get("refCode") ?? "").trim() || null,
      items: { create: items },
      ownerId: user?.id ?? null,
    },
  });

  // Se já nasce confirmado/faturado, aplica os efeitos no estoque e financeiro.
  if (ACTIVE.includes(status)) {
    await applyConfirm(order.id);
    await prisma.order.update({ where: { id: order.id }, data: { status } });
  }
  await logAudit({ action: "CREATE", entity: "Pedido", entityId: order.id, summary: `Pedido ${order.number} criado` });

  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/finance");
  revalidatePath("/");
}

export async function updateOrderStatus(formData: FormData) {
  const id = Number(formData.get("id"));
  const next = String(formData.get("status") ?? "");
  if (!id || !ORDER_STATUSES.includes(next as (typeof ORDER_STATUSES)[number])) return;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return;

  const wasActive = ACTIVE.includes(order.status);
  const willActive = ACTIVE.includes(next);

  if (order.status === "DRAFT" && willActive) {
    await applyConfirm(id); // baixa estoque + gera conta a receber
  }
  if (wasActive && next === "CANCELLED") {
    await reverseConfirm(id); // devolve estoque + cancela conta a receber
  }

  await prisma.order.update({
    where: { id },
    data: { status: asEnum(ORDER_STATUSES, next, "DRAFT") },
  });
  await logAudit({ action: "STATUS", entity: "Pedido", entityId: id, summary: `Status → ${ORDER_STATUS_LABELS[next]}` });

  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/finance");
  revalidatePath("/");
}

// Arquiva o pedido (Lixeira). Devolve o estoque e arquiva as cobranças
// vinculadas — restaurar pelo Lixeira traz o pedido de volta como rascunho.
export async function deleteOrder(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return;

  if (ACTIVE.includes(order.status)) await reverseConfirm(id);
  await prisma.transaction.updateMany({
    where: { orderId: id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await prisma.order.update({
    where: { id },
    // Volta a rascunho: o estoque já foi devolvido acima.
    data: { deletedAt: new Date(), status: "DRAFT" },
  });
  await logAudit({ action: "DELETE", entity: "Pedido", entityId: id, summary: `Pedido ${order.number} arquivado` });

  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/finance");
  revalidatePath("/");
}

// ---- efeitos de integração (não exportados) ----

async function applyConfirm(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, transactions: true },
  });
  if (!order) return;

  for (const it of order.items) {
    // Serviços não controlam estoque.
    if (it.product.kind === "SERVICE") continue;
    await prisma.product.update({
      where: { id: it.productId },
      data: { stock: { decrement: it.quantity } },
    });
  }

  if (order.transactions.length === 0) {
    await prisma.transaction.create({
      data: {
        description: `Receita do pedido ${order.number}`,
        type: "RECEIVABLE",
        amount: order.total,
        dueDate: addDays(new Date(), 30),
        status: "PENDING",
        orderId: order.id,
        customerId: order.customerId,
        ownerId: order.ownerId,
      },
    });
  }
}

async function reverseConfirm(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return;

  for (const it of order.items) {
    if (it.product.kind === "SERVICE") continue;
    await prisma.product.update({
      where: { id: it.productId },
      data: { stock: { increment: it.quantity } },
    });
  }
  await prisma.transaction.deleteMany({
    where: { orderId, status: "PENDING" },
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
