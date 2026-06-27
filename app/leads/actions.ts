"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export async function createLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const lead = await prisma.lead.create({
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      document: str(formData.get("document")),
      source: str(formData.get("source")),
      value: num(formData.get("value")),
      stage: "NEW",
    },
  });
  await logAudit({ action: "CREATE", entity: "Orçamento", entityId: lead.id, summary: `Orçamento "${name}" criado` });

  revalidatePath("/leads");
  revalidatePath("/");
}

export async function updateLead(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const stage = String(formData.get("stage") ?? "NEW");
  if (!id || !name) return;

  await prisma.lead.update({
    where: { id },
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      document: str(formData.get("document")),
      source: str(formData.get("source")),
      value: num(formData.get("value")),
      stage: asEnum(LEAD_STAGES, stage, "NEW"),
    },
  });
  await logAudit({ action: "UPDATE", entity: "Orçamento", entityId: id, summary: `Orçamento "${name}" editado` });

  revalidatePath("/leads");
  redirect(`/leads/${id}`);
}

export async function updateLeadStage(formData: FormData) {
  const id = Number(formData.get("id"));
  const stage = String(formData.get("stage") ?? "");
  if (!id || !LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) return;

  await prisma.lead.update({ where: { id }, data: { stage: asEnum(LEAD_STAGES, stage, "NEW") } });
  await logAudit({ action: "STATUS", entity: "Orçamento", entityId: id, summary: `Etapa → ${LEAD_STAGE_LABELS[stage]}` });
  revalidatePath("/leads");
  revalidatePath("/");
}

// Converte um lead ganho em cliente do CRM (unificação CRM ↔ cadastro).
export async function convertLeadToCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;

  const customer = await prisma.customer.create({
    data: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      document: lead.document,
    },
  });

  await prisma.lead.update({
    where: { id },
    data: { stage: "WON", customerId: customer.id },
  });
  await logAudit({ action: "UPDATE", entity: "Orçamento", entityId: id, summary: `Convertido em cliente "${customer.name}"` });

  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/");
}

export async function deleteLead(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ action: "DELETE", entity: "Orçamento", entityId: id, summary: "Orçamento arquivado" });
  revalidatePath("/leads");
  revalidatePath("/");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
