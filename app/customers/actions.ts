"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.customer.create({
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      company: str(formData.get("company")),
      document: str(formData.get("document")),
      notes: str(formData.get("notes")),
    },
  });

  revalidatePath("/customers");
  revalidatePath("/");
}

export async function updateCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      company: str(formData.get("company")),
      document: str(formData.get("document")),
      notes: str(formData.get("notes")),
    },
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  // Impede excluir cliente com pedidos vinculados.
  const orders = await prisma.order.count({ where: { customerId: id } });
  if (orders > 0) return;

  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
