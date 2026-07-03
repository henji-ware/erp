"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_LOSS_REASONS } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdmin } from "@/lib/auth";

// Usuário comum só pode mexer nos próprios orçamentos; admin em todos.
async function canEditLead(id: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (isAdmin(user)) return true;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerId: true } });
  return !!lead && lead.ownerId === user?.id;
}

// Próximo número sequencial do orçamento: AAMMNN, reinicia a cada mês.
async function nextLeadNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const key = `${yy}${mm}`;
  const counter = await prisma.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}${String(counter.value).padStart(2, "0")}`;
}

export async function createLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const user = await getCurrentUser();
  const lead = await prisma.lead.create({
    data: {
      number: await nextLeadNumber(),
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      document: str(formData.get("document")),
      source: str(formData.get("source")),
      value: num(formData.get("value")),
      stage: "NEW",
      customerId: Number(formData.get("customerId")) || null,
      ownerId: user?.id ?? null,
    },
  });
  await logAudit({ action: "CREATE", entity: "Orçamento", entityId: lead.id, summary: `Orçamento ${lead.number} "${name}" criado` });

  revalidatePath("/leads");
  revalidatePath("/");
}

export async function updateLead(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const stage = asEnum(LEAD_STAGES, formData.get("stage"), "NEW");
  if (!id || !name) return;
  if (!(await canEditLead(id))) return;

  // Motivo da perda só se aplica quando o orçamento está "Perdido".
  const isLost = stage === "LOST";
  const lossReasonRaw = String(formData.get("lossReason") ?? "");
  const lossReason =
    isLost && LEAD_LOSS_REASONS.includes(lossReasonRaw as (typeof LEAD_LOSS_REASONS)[number])
      ? (lossReasonRaw as (typeof LEAD_LOSS_REASONS)[number])
      : null;

  await prisma.lead.update({
    where: { id },
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      document: str(formData.get("document")),
      source: str(formData.get("source")),
      value: num(formData.get("value")),
      stage,
      customerId: Number(formData.get("customerId")) || null,
      lossReason,
      lossNote: isLost ? str(formData.get("lossNote")) : null,
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
  if (!(await canEditLead(id))) return;

  await prisma.lead.update({ where: { id }, data: { stage: asEnum(LEAD_STAGES, stage, "NEW") } });
  await logAudit({ action: "STATUS", entity: "Orçamento", entityId: id, summary: `Etapa → ${LEAD_STAGE_LABELS[stage]}` });
  revalidatePath("/leads");
  revalidatePath("/");
}

// Converte um lead ganho em cliente do CRM (unificação CRM ↔ cadastro).
export async function convertLeadToCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await canEditLead(id))) return;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;

  const user = await getCurrentUser();
  const customer = await prisma.customer.create({
    data: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      document: lead.document,
      // Herda o dono do orçamento (senão quem converteu não veria o cliente).
      ownerId: lead.ownerId ?? user?.id ?? null,
      shared: lead.shared,
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
  if (!(await canEditLead(id))) return;
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
