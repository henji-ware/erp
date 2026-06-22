"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.supplier.create({
    data: {
      name,
      document: str(formData.get("document")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      notes: str(formData.get("notes")),
    },
  });

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
      document: str(formData.get("document")),
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      notes: str(formData.get("notes")),
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const used = await prisma.transaction.count({ where: { supplierId: id } });
  if (used > 0) return;

  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/suppliers");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
