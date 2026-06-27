"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

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

  await prisma.product.update({
    where: { id },
    data: {
      name,
      kind,
      price: num(formData.get("price")),
      cost: num(formData.get("cost")),
      stock: kind === "SERVICE" ? 0 : int(formData.get("stock")),
    },
  });
  await logAudit({ action: "UPDATE", entity: "Produto", entityId: id, summary: `"${name}" editado` });

  revalidatePath("/products");
  redirect("/products");
}

// Ajuste manual de estoque (entrada/saída).
export async function adjustStock(formData: FormData) {
  const id = Number(formData.get("id"));
  const delta = int(formData.get("delta"));
  if (!id || !delta) return;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return;

  await prisma.product.update({
    where: { id },
    data: { stock: Math.max(0, product.stock + delta) },
  });

  revalidatePath("/products");
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
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function int(v: FormDataEntryValue | null): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}
