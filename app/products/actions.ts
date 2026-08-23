"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth";
import type { StockReason } from "@prisma/client";

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  let sku = String(formData.get("sku") ?? "").trim();
  if (!name) return;
  if (!sku) sku = "SKU-" + Date.now().toString(36).toUpperCase();

  // SKU é único: evita conflito silenciosamente.
  const exists = await prisma.product.findUnique({ where: { sku } });
  if (exists) sku = sku + "-" + Date.now().toString(36).slice(-3).toUpperCase();

  const kind = formData.get("kind") === "SERVICE" ? "SERVICE" : "PRODUCT";

  const product = await prisma.product.create({
    data: {
      sku,
      name,
      kind,
      price: num(formData.get("price")),
      cost: num(formData.get("cost")),
      stock: kind === "SERVICE" ? 0 : int(formData.get("stock")),
    },
  });
  await logAudit({ action: "CREATE", entity: "Produto", entityId: product.id, summary: `"${name}" (${sku}) criado` });

  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const kind = formData.get("kind") === "SERVICE" ? "SERVICE" : "PRODUCT";

  // `stock` NÃO é editável por aqui de propósito. Gravar o saldo direto
  // furaria o razão: o número mudaria sem nenhuma linha explicando por quê,
  // que é justamente o problema que o razão existe para resolver. Saldo se
  // move por entrada de compra ou acerto manual, ambos registrados.
  //
  // A exceção é virar SERVIÇO: serviço não tem estoque, e deixar um saldo
  // pendurado num item sem unidade física confunde o inventário. O zeramento
  // vira uma linha de acerto, não uma escrita silenciosa.
  const virouServico = kind === "SERVICE";
  const anterior = virouServico
    ? await prisma.product.findUnique({ where: { id }, select: { stock: true } })
    : null;

  await prisma.product.update({
    where: { id },
    data: {
      name,
      kind,
      price: num(formData.get("price")),
      cost: num(formData.get("cost")),
      ...(virouServico ? { stock: 0 } : {}),
    },
  });

  if (virouServico && anterior && anterior.stock !== 0) {
    const user = await getCurrentUser();
    await prisma.stockMovement.create({
      data: {
        productId: id,
        quantity: -anterior.stock,
        balance: 0,
        reason: "ADJUSTMENT",
        note: "Item convertido em serviço — saldo zerado",
        userId: user?.id ?? null,
        userName: user?.name ?? null,
      },
    });
  }
  await logAudit({ action: "UPDATE", entity: "Produto", entityId: id, summary: `"${name}" editado` });

  revalidatePath("/products");
  redirect("/products");
}

// Ajuste manual de estoque (entrada/saída).
/**
 * Grava a movimentação e o novo saldo na MESMA transação.
 *
 * Estoque e razão precisam andar juntos: se o saldo mudasse e a linha do
 * razão falhasse, o histórico deixaria de explicar o número — que é
 * exatamente o problema que o razão existe para resolver.
 */
async function moveStock(opts: {
  productId: number;
  delta: number;
  reason: StockReason;
  note?: string | null;
  supplierId?: number | null;
  unitCost?: number | null;
  /** Acerto manual não deixa o saldo negativo; baixa de pedido pode. */
  clampAtZero?: boolean;
}): Promise<number | null> {
  const user = await getCurrentUser();

  return prisma.$transaction(async (db) => {
    const product = await db.product.findUnique({
      where: { id: opts.productId },
      select: { id: true, stock: true, name: true },
    });
    if (!product) return null;

    const bruto = product.stock + opts.delta;
    const saldo = opts.clampAtZero ? Math.max(0, bruto) : bruto;
    // O delta REAL pode diferir do pedido quando o saldo bate no zero; o
    // razão precisa registrar o que de fato aconteceu.
    const efetivo = saldo - product.stock;
    if (efetivo === 0) return product.stock;

    await db.product.update({ where: { id: product.id }, data: { stock: saldo } });
    await db.stockMovement.create({
      data: {
        productId: product.id,
        quantity: efetivo,
        balance: saldo,
        reason: opts.reason,
        note: opts.note ?? null,
        supplierId: opts.supplierId ?? null,
        unitCost: opts.unitCost ?? null,
        userId: user?.id ?? null,
        userName: user?.name ?? null,
      },
    });
    return saldo;
  });
}

export async function adjustStock(formData: FormData) {
  const id = Number(formData.get("id"));
  const delta = int(formData.get("delta"));
  if (!id || !delta) return;

  const note = String(formData.get("note") ?? "").trim() || null;
  const saldo = await moveStock({
    productId: id,
    delta,
    reason: "ADJUSTMENT",
    note,
    clampAtZero: true,
  });
  if (saldo === null) return;

  await logAudit({
    action: "UPDATE",
    entity: "Produto",
    entityId: id,
    summary: `Acerto de estoque ${delta > 0 ? "+" : ""}${delta} → ${saldo}${note ? ` (${note})` : ""}`,
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/");
}

/** Entrada de mercadoria por compra: é o caminho pelo qual o estoque SOBE. */
export async function receiveStock(formData: FormData) {
  const id = Number(formData.get("id"));
  const quantity = int(formData.get("quantity"));
  if (!id || quantity <= 0) return;

  const supplierId = Number(formData.get("supplierId")) || null;
  const unitCostRaw = String(formData.get("unitCost") ?? "").trim();
  const unitCost = unitCostRaw ? parseMoney(unitCostRaw) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  // Fornecedor informado precisa existir — o id vem de um <select>, mas o
  // formulário é postável à mão.
  if (supplierId) {
    const exists = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return;
  }

  const saldo = await moveStock({
    productId: id,
    delta: quantity,
    reason: "PURCHASE",
    note,
    supplierId,
    unitCost,
  });
  if (saldo === null) return;

  await logAudit({
    action: "UPDATE",
    entity: "Produto",
    entityId: id,
    summary: `Entrada por compra: +${quantity} → ${saldo}`,
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) return; // produto já usado em pedidos não pode ser arquivado

  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Produto", entityId: id, summary: "Produto/serviço arquivado" });
  revalidatePath("/products");
  revalidatePath("/");
}

function num(v: FormDataEntryValue | null): number {
  return parseMoney(v);
}
function int(v: FormDataEntryValue | null): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}
