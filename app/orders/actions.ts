"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { asEnum, ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditRecord } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { roundMoney } from "@/lib/money";
import { orderTransitionEffect } from "@/lib/order-transition";
import { applyConfirm, reverseConfirm } from "@/lib/order-effects";

type DbClient = Prisma.TransactionClient;

// Autorização: só o dono (ou admin) altera o pedido.
async function allowed(id: number): Promise<boolean> {
  return canEditRecord(await prisma.order.findUnique({ where: { id }, select: { ownerId: true } }));
}

const ACTIVE = ["CONFIRMED", "INVOICED"];

/** Quem provocou o movimento de estoque, para a linha do razão. */
async function actorInfo() {
  const user = await getCurrentUser();
  return { id: user?.id ?? null, name: user?.name ?? null };
}

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
      total = roundMoney(total + unitPrice * qty);
    }
  });

  if (items.length === 0) return;

  const sellerId = Number(formData.get("sellerId")) || null;
  const user = await getCurrentUser();

  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim() || null;

  const actor = { id: user?.id ?? null, name: user?.name ?? null };
  const order = await prisma.$transaction(async (db) => {
    const created = await db.order.create({
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

    // Se já nasce confirmado/faturado, os três efeitos pertencem à mesma
    // transação: estoque, cobrança e status nunca ficam parcialmente aplicados.
    if (ACTIVE.includes(status)) {
      await applyConfirm(db, created.id, new Date(), actor);
      await db.order.update({ where: { id: created.id }, data: { status } });
    }
    return created;
  });
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
  if (!(await allowed(id))) return;

  const actor = await actorInfo();
  const changed = await prisma.$transaction(async (db) => {
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.status === next) return false;

    // Compare-and-set impede duas requisições simultâneas de aplicarem os
    // efeitos da mesma transição mais de uma vez.
    const claimed = await db.order.updateMany({
      where: { id, status: order.status },
      data: { status: asEnum(ORDER_STATUSES, next, "DRAFT") },
    });
    if (claimed.count !== 1) return false;

    const effect = orderTransitionEffect(order.status, next);
    if (effect === "APPLY") await applyConfirm(db, id, new Date(), actor);
    if (effect === "REVERSE") await reverseConfirm(db, id, actor);
    return true;
  });
  if (!changed) return;
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
  if (!(await allowed(id))) return;

  const actor = await actorInfo();
  const order = await prisma.$transaction(async (db) => {
    const current = await db.order.findUnique({ where: { id } });
    if (!current || current.deletedAt) return null;

    const claimed = await db.order.updateMany({
      where: { id, status: current.status, deletedAt: null },
      data: { deletedAt: new Date(), status: "DRAFT" },
    });
    if (claimed.count !== 1) return null;

    if (ACTIVE.includes(current.status)) await reverseConfirm(db, id, actor);
    await db.transaction.updateMany({
      where: { orderId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return current;
  });
  if (!order) return;
  await logAudit({ action: "DELETE", entity: "Pedido", entityId: id, summary: `Pedido ${order.number} arquivado` });

  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/finance");
  revalidatePath("/");
}

// ---- efeitos de integração (não exportados) ----

