"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { TRASH_TTL_DAYS } from "@/lib/format";

type Entity = "customer" | "product" | "supplier" | "project" | "lead";

const META: Record<Entity, { label: string; path: string }> = {
  customer: { label: "Cliente", path: "/customers" },
  product: { label: "Produto", path: "/products" },
  supplier: { label: "Fornecedor", path: "/suppliers" },
  project: { label: "Projeto", path: "/projects" },
  lead: { label: "Orçamento", path: "/leads" },
};

function parse(formData: FormData): { entity: Entity; id: number } | null {
  const entity = String(formData.get("entity") ?? "") as Entity;
  const id = Number(formData.get("id"));
  if (!META[entity] || !id) return null;
  return { entity, id };
}

// Restaura um item arquivado (deletedAt = null).
export async function restoreItem(formData: FormData) {
  const p = parse(formData);
  if (!p) return;
  const { entity, id } = p;

  switch (entity) {
    case "customer": await prisma.customer.update({ where: { id }, data: { deletedAt: null } }); break;
    case "product": await prisma.product.update({ where: { id }, data: { deletedAt: null } }); break;
    case "supplier": await prisma.supplier.update({ where: { id }, data: { deletedAt: null } }); break;
    case "project": await prisma.project.update({ where: { id }, data: { deletedAt: null } }); break;
    case "lead": await prisma.lead.update({ where: { id }, data: { deletedAt: null } }); break;
  }

  await logAudit({ action: "UPDATE", entity: META[entity].label, entityId: id, summary: "Restaurado da lixeira" });
  revalidatePath("/trash");
  revalidatePath(META[entity].path);
  revalidatePath("/");
}

// Remove definitivamente itens arquivados há mais de 30 dias. Chamado ao abrir
// a Lixeira (limpeza automática) — best effort, ignora vínculos.
export async function purgeExpiredTrash(): Promise<void> {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 86400000);
  const where = { deletedAt: { lt: cutoff } };
  try { await prisma.lead.deleteMany({ where }); } catch {}
  try { await prisma.project.deleteMany({ where }); } catch {}
  try { await prisma.customer.deleteMany({ where }); } catch {}
  try { await prisma.product.deleteMany({ where }); } catch {}
  try { await prisma.supplier.deleteMany({ where }); } catch {}
}

// Esvazia a lixeira inteira agora (todos os arquivados).
export async function emptyTrash() {
  const where = { deletedAt: { not: null } };
  try { await prisma.lead.deleteMany({ where }); } catch {}
  try { await prisma.project.deleteMany({ where }); } catch {}
  try { await prisma.customer.deleteMany({ where }); } catch {}
  try { await prisma.product.deleteMany({ where }); } catch {}
  try { await prisma.supplier.deleteMany({ where }); } catch {}
  await logAudit({ action: "DELETE", entity: "Lixeira", summary: "Lixeira esvaziada" });
  revalidatePath("/trash");
}

// Exclui DEFINITIVAMENTE (sem volta).
export async function purgeItem(formData: FormData) {
  const p = parse(formData);
  if (!p) return;
  const { entity, id } = p;

  try {
    switch (entity) {
      case "customer": await prisma.customer.delete({ where: { id } }); break;
      case "product": await prisma.product.delete({ where: { id } }); break;
      case "supplier": await prisma.supplier.delete({ where: { id } }); break;
      case "project": await prisma.project.delete({ where: { id } }); break;
      case "lead": await prisma.lead.delete({ where: { id } }); break;
    }
    await logAudit({ action: "DELETE", entity: META[entity].label, entityId: id, summary: "Excluído definitivamente" });
  } catch {
    // Se houver vínculos que impedem a exclusão, mantém arquivado.
    return;
  }

  revalidatePath("/trash");
  revalidatePath("/");
}
