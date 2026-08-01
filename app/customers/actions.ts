"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { isValidDocument, normalizeDocument } from "@/lib/document";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const user = await getCurrentUser();
  const customer = await prisma.customer.create({
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      company: str(formData.get("company")),
      document: doc(formData.get("document")),
      address: str(formData.get("address")),
      notes: str(formData.get("notes")),
      ownerId: user?.id ?? null,
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
  const existing = await prisma.customer.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || !canEdit(await getCurrentUser(), existing)) return;

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      company: str(formData.get("company")),
      document: doc(formData.get("document")),
      address: str(formData.get("address")),
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
      ownerId: true,
      // Só vínculos ATIVOS impedem o arquivamento (os da Lixeira não contam).
      _count: {
        select: {
          orders: { where: { deletedAt: null } },
          projects: { where: { deletedAt: null } },
          inspections: { where: { deletedAt: null } },
          leads: { where: { deletedAt: null } },
          transactions: { where: { deletedAt: null } },
          appointments: { where: { deletedAt: null } },
          rentals: { where: { deletedAt: null } },
          maintenanceContracts: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!c) return;
  if (!canEdit(await getCurrentUser(), c)) return;
  const linked =
    c._count.orders +
    c._count.projects +
    c._count.inspections +
    c._count.leads +
    c._count.transactions +
    c._count.appointments +
    c._count.rentals +
    c._count.maintenanceContracts;
  if (linked > 0) return;

  // Soft delete: vai para a Lixeira (recuperável), não some de vez.
  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Cliente", entityId: id, summary: "Cliente arquivado" });
  revalidatePath("/customers");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
// CPF/CNPJ: descarta documento inválido (o formulário já avisa o usuário).
function doc(v: FormDataEntryValue | null): string | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  return isValidDocument(raw) ? normalizeDocument(raw) : null;
}
