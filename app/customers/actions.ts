"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const customer = await prisma.customer.create({
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      company: str(formData.get("company")),
      document: str(formData.get("document")),
      notes: str(formData.get("notes")),
    },
  });
  await logAudit({ action: "CREATE", entity: "Cliente", entityId: customer.id, summary: `Cliente "${name}" criado` });

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
  await logAudit({ action: "UPDATE", entity: "Cliente", entityId: id, summary: `Cliente "${name}" editado` });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  // Não exclui cliente com registros vinculados (pedidos, projetos, inspeções,
  // orçamentos, lançamentos ou agendamentos) — evita erro de chave estrangeira.
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          orders: true,
          projects: true,
          inspections: true,
          leads: true,
          transactions: true,
          appointments: true,
        },
      },
    },
  });
  if (!c) return;
  const linked =
    c._count.orders +
    c._count.projects +
    c._count.inspections +
    c._count.leads +
    c._count.transactions +
    c._count.appointments;
  if (linked > 0) return;

  await prisma.customer.delete({ where: { id } });
  await logAudit({ action: "DELETE", entity: "Cliente", entityId: id, summary: "Cliente excluído" });
  revalidatePath("/customers");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
