"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { TRASH_TTL_DAYS } from "@/lib/format";
import { getCurrentUser, isAdmin, canEdit } from "@/lib/auth";

type Entity =
  | "customer"
  | "product"
  | "supplier"
  | "project"
  | "lead"
  | "transaction"
  | "inspection"
  | "appointment"
  | "rental"
  | "maintenanceContract"
  | "order";

const META: Record<Entity, { label: string; path: string }> = {
  customer: { label: "Cliente", path: "/customers" },
  product: { label: "Produto", path: "/products" },
  supplier: { label: "Fornecedor", path: "/suppliers" },
  project: { label: "Projeto", path: "/projects" },
  lead: { label: "Orçamento", path: "/leads" },
  transaction: { label: "Financeiro", path: "/finance" },
  inspection: { label: "Inspeção", path: "/inspections" },
  appointment: { label: "Agendamento", path: "/appointments" },
  rental: { label: "Locação", path: "/rentals" },
  maintenanceContract: { label: "Manutenção", path: "/maintenance" },
  order: { label: "Pedido", path: "/orders" },
};

// Delegates tipados por entidade (o Prisma não tem API genérica de model).
function setDeleted(entity: Entity, id: number, deletedAt: Date | null) {
  switch (entity) {
    case "customer": return prisma.customer.update({ where: { id }, data: { deletedAt } });
    case "product": return prisma.product.update({ where: { id }, data: { deletedAt } });
    case "supplier": return prisma.supplier.update({ where: { id }, data: { deletedAt } });
    case "project": return prisma.project.update({ where: { id }, data: { deletedAt } });
    case "lead": return prisma.lead.update({ where: { id }, data: { deletedAt } });
    case "transaction": return prisma.transaction.update({ where: { id }, data: { deletedAt } });
    case "inspection": return prisma.inspection.update({ where: { id }, data: { deletedAt } });
    case "appointment": return prisma.appointment.update({ where: { id }, data: { deletedAt } });
    case "rental": return prisma.rental.update({ where: { id }, data: { deletedAt } });
    case "maintenanceContract": return prisma.maintenanceContract.update({ where: { id }, data: { deletedAt } });
    case "order": return prisma.order.update({ where: { id }, data: { deletedAt } });
  }
}

function hardDelete(entity: Entity, id: number) {
  switch (entity) {
    case "customer": return prisma.customer.delete({ where: { id } });
    case "product": return prisma.product.delete({ where: { id } });
    case "supplier": return prisma.supplier.delete({ where: { id } });
    case "project": return prisma.project.delete({ where: { id } });
    case "lead": return prisma.lead.delete({ where: { id } });
    case "transaction": return prisma.transaction.delete({ where: { id } });
    case "inspection": return prisma.inspection.delete({ where: { id } });
    case "appointment": return prisma.appointment.delete({ where: { id } });
    case "rental": return prisma.rental.delete({ where: { id } });
    case "maintenanceContract": return prisma.maintenanceContract.delete({ where: { id } });
    case "order": return prisma.order.delete({ where: { id } }); // itens em cascata
  }
}

function parse(formData: FormData): { entity: Entity; id: number } | null {
  const entity = String(formData.get("entity") ?? "") as Entity;
  const id = Number(formData.get("id"));
  if (!META[entity] || !id) return null;
  return { entity, id };
}

// Dono do registro arquivado (produtos e fornecedores são compartilhados e
// não têm dono — qualquer usuário logado pode restaurá-los).
async function ownerOf(entity: Entity, id: number): Promise<{ ownerId: number | null } | null> {
  const sel = { select: { ownerId: true }, where: { id } };
  switch (entity) {
    case "customer": return prisma.customer.findUnique(sel);
    case "project": return prisma.project.findUnique(sel);
    case "lead": return prisma.lead.findUnique(sel);
    case "transaction": return prisma.transaction.findUnique(sel);
    case "inspection": return prisma.inspection.findUnique(sel);
    case "appointment": return prisma.appointment.findUnique(sel);
    case "rental": return prisma.rental.findUnique(sel);
    case "maintenanceContract": return prisma.maintenanceContract.findUnique(sel);
    case "order": return prisma.order.findUnique(sel);
    // Catálogo compartilhado: sem dono.
    case "product": return { ownerId: null };
    case "supplier": return { ownerId: null };
  }
}

// Restaurar é reversível: permitido ao dono, ao admin e em itens compartilhados.
async function canRestore(entity: Entity, id: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (isAdmin(user)) return true;
  const rec = await ownerOf(entity, id);
  if (!rec) return false;
  return rec.ownerId === null || canEdit(user, rec);
}

// Restaura um item arquivado (deletedAt = null).
export async function restoreItem(formData: FormData) {
  const p = parse(formData);
  if (!p) return;
  if (!(await canRestore(p.entity, p.id))) return;

  await setDeleted(p.entity, p.id, null);
  await logAudit({ action: "UPDATE", entity: META[p.entity].label, entityId: p.id, summary: "Restaurado da lixeira" });
  revalidatePath("/trash");
  revalidatePath(META[p.entity].path);
  revalidatePath("/");
}

// Exclui DEFINITIVAMENTE (sem volta) — restrito a administradores.
export async function purgeItem(formData: FormData) {
  const p = parse(formData);
  if (!p) return;
  if (!isAdmin(await getCurrentUser())) return;

  try {
    await hardDelete(p.entity, p.id);
    await logAudit({ action: "DELETE", entity: META[p.entity].label, entityId: p.id, summary: "Excluído definitivamente" });
  } catch {
    // Se houver vínculos que impedem a exclusão, mantém arquivado.
    return;
  }

  revalidatePath("/trash");
  revalidatePath("/");
}

// Remove definitivamente itens arquivados há mais de 30 dias. Chamado ao abrir
// a Lixeira (limpeza automática) — best effort, ignora vínculos.
export async function purgeExpiredTrash(): Promise<void> {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 86400000);
  const where = { deletedAt: { lt: cutoff } };
  try { await prisma.transaction.deleteMany({ where }); } catch {}
  try { await prisma.order.deleteMany({ where }); } catch {}
  try { await prisma.inspection.deleteMany({ where }); } catch {}
  try { await prisma.appointment.deleteMany({ where }); } catch {}
  try { await prisma.rental.deleteMany({ where }); } catch {}
  try { await prisma.maintenanceContract.deleteMany({ where }); } catch {}
  try { await prisma.lead.deleteMany({ where }); } catch {}
  try { await prisma.project.deleteMany({ where }); } catch {}
  try { await prisma.customer.deleteMany({ where }); } catch {}
  try { await prisma.product.deleteMany({ where }); } catch {}
  try { await prisma.supplier.deleteMany({ where }); } catch {}
}

// Esvazia a lixeira inteira agora — ação destrutiva, restrita a administradores.
export async function emptyTrash() {
  if (!isAdmin(await getCurrentUser())) return;
  const where = { deletedAt: { not: null } };
  try { await prisma.transaction.deleteMany({ where }); } catch {}
  try { await prisma.order.deleteMany({ where }); } catch {}
  try { await prisma.inspection.deleteMany({ where }); } catch {}
  try { await prisma.appointment.deleteMany({ where }); } catch {}
  try { await prisma.rental.deleteMany({ where }); } catch {}
  try { await prisma.maintenanceContract.deleteMany({ where }); } catch {}
  try { await prisma.lead.deleteMany({ where }); } catch {}
  try { await prisma.project.deleteMany({ where }); } catch {}
  try { await prisma.customer.deleteMany({ where }); } catch {}
  try { await prisma.product.deleteMany({ where }); } catch {}
  try { await prisma.supplier.deleteMany({ where }); } catch {}
  await logAudit({ action: "DELETE", entity: "Lixeira", summary: "Lixeira esvaziada" });
  revalidatePath("/trash");
}
