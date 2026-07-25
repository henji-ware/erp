"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { isValidDocument, normalizeDocument } from "@/lib/document";
import { SUPPLIER_CATEGORIES } from "@/lib/format";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supplier = await prisma.supplier.create({
    data: {
      name,
      document: doc(formData.get("document")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      category: category(formData.get("category")),
      products: str(formData.get("products")),
      services: str(formData.get("services")),
      notes: str(formData.get("notes")),
    },
  });
  await logAudit({ action: "CREATE", entity: "Fornecedor", entityId: supplier.id, summary: `"${name}" cadastrado` });

  revalidatePath("/suppliers");
}

export async function updateSupplier(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await prisma.supplier.update({
    where: { id },
    data: {
      name,
      document: doc(formData.get("document")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      category: category(formData.get("category")),
      products: str(formData.get("products")),
      services: str(formData.get("services")),
      notes: str(formData.get("notes")),
    },
  });
  await logAudit({ action: "UPDATE", entity: "Fornecedor", entityId: id, summary: `"${name}" editado` });

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const used = await prisma.transaction.count({ where: { supplierId: id } });
  if (used > 0) return;

  await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Fornecedor", entityId: id, summary: "Fornecedor arquivado" });
  revalidatePath("/suppliers");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function category(v: FormDataEntryValue | null): (typeof SUPPLIER_CATEGORIES)[number] | null {
  const s = String(v ?? "").trim();
  return SUPPLIER_CATEGORIES.includes(s as (typeof SUPPLIER_CATEGORIES)[number])
    ? (s as (typeof SUPPLIER_CATEGORIES)[number])
    : null;
}
// CPF/CNPJ: descarta documento inválido (o formulário já avisa o usuário).
function doc(v: FormDataEntryValue | null): string | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  return isValidDocument(raw) ? normalizeDocument(raw) : null;
}
