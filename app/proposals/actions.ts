"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { asEnum } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import {
  GREETING_PADRAO,
  PROPOSAL_TYPES,
  PROPOSAL_TYPE_LABELS,
  proposalTemplate,
} from "@/lib/proposals";

// Usuário comum só mexe nas propostas dos próprios orçamentos.
async function canEditLead(leadId: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (isAdmin(user)) return true;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { ownerId: true } });
  return !!lead && lead.ownerId === user?.id;
}

// Cria a próxima revisão da proposta a partir do orçamento, já preenchida com
// os dados do cliente e o texto padrão do tipo de serviço escolhido.
export async function createProposal(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  if (!leadId || !(await canEditLead(leadId))) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { customer: true, proposals: { orderBy: { revision: "desc" }, take: 1 } },
  });
  if (!lead) return;

  const type = asEnum(PROPOSAL_TYPES, formData.get("type"), "INSPECAO");
  const t = proposalTemplate(type);
  const previous = lead.proposals[0];
  const revision = previous ? previous.revision + 1 : 0;
  const user = await getCurrentUser();

  // A partir da 2ª revisão, mantém o que já foi escrito na anterior.
  const proposal = await prisma.proposal.create({
    data: {
      leadId,
      revision,
      type,
      title: previous?.title ?? t.title,
      treatment: previous?.treatment ?? "A",
      clientName: lead.customer?.name ?? lead.name,
      clientCity: previous?.clientCity ?? null,
      siteLocation: previous?.siteLocation ?? null,
      showNorms: previous?.showNorms ?? false,
      contactName: previous?.contactName ?? null,
      contactPhone: previous?.contactPhone ?? lead.phone,
      contactEmail: previous?.contactEmail ?? lead.email,
      greeting: previous?.greeting ?? GREETING_PADRAO,
      intro: previous?.intro ?? t.intro,
      scope: previous?.scope ?? t.scope,
      findings: previous?.findings ?? null,
      included: previous?.included ?? t.included,
      notes: previous?.notes ?? t.notes,
      amount: previous?.amount ?? lead.value,
      amountLabel: previous?.amountLabel ?? t.amountLabel,
      laborLabel: previous?.laborLabel ?? t.laborLabel ?? null,
      laborAmount: previous?.laborAmount ?? 0,
      equipmentLabel: previous?.equipmentLabel ?? t.equipmentLabel ?? null,
      equipmentAmount: previous?.equipmentAmount ?? 0,
      freightAmount: previous?.freightAmount ?? 0,
      deadline: previous?.deadline ?? t.deadline,
      fabricationDeadline: previous?.fabricationDeadline ?? t.fabricationDeadline ?? null,
      schedule: previous?.schedule ?? t.schedule ?? null,
      paymentTerms: previous?.paymentTerms ?? t.paymentTerms,
      taxes: previous?.taxes ?? t.taxes,
      unloading: previous?.unloading ?? t.unloading ?? null,
      surfaceTreatment: previous?.surfaceTreatment ?? t.surfaceTreatment ?? null,
      colors: previous?.colors ?? t.colors ?? null,
      floorNote: previous?.floorNote ?? t.floorNote ?? null,
      warranty: previous?.warranty ?? t.warranty ?? null,
      purchaseConfirmation: previous?.purchaseConfirmation ?? t.purchaseConfirmation ?? null,
      ncm: previous?.ncm ?? t.ncm ?? null,
      validityDays: previous?.validityDays ?? 10,
      signedBy: previous?.signedBy ?? user?.name ?? null,
      signerEmail: previous?.signerEmail ?? user?.email ?? null,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "Proposta",
    entityId: proposal.id,
    summary: `Proposta R${revision} (${PROPOSAL_TYPE_LABELS[type]}) do orçamento ${lead.number ?? leadId}`,
  });

  revalidatePath(`/leads/${leadId}`);
  redirect(`/proposals/${proposal.id}`);
}

export async function updateProposal(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const current = await prisma.proposal.findUnique({ where: { id } });
  if (!current || !(await canEditLead(current.leadId))) return;

  // Com itens no orçamento o campo de valor fica desabilitado e o navegador
  // não o envia — sem isso, salvar zeraria o valor fechado já digitado.
  const amountRaw = formData.get("amount");

  await prisma.proposal.update({
    where: { id },
    data: {
      type: asEnum(PROPOSAL_TYPES, formData.get("type"), "INSPECAO"),
      title: String(formData.get("title") ?? "").trim() || current.title,
      treatment: String(formData.get("treatment") ?? "A").trim() || "A",
      clientName: String(formData.get("clientName") ?? "").trim() || current.clientName,
      clientCity: str(formData.get("clientCity")),
      siteLocation: str(formData.get("siteLocation")),
      showNorms: formData.get("showNorms") === "on",
      contactName: str(formData.get("contactName")),
      contactPhone: str(formData.get("contactPhone")),
      contactEmail: str(formData.get("contactEmail")),
      greeting: str(formData.get("greeting")),
      intro: String(formData.get("intro") ?? ""),
      scope: String(formData.get("scope") ?? ""),
      findings: str(formData.get("findings")),
      included: str(formData.get("included")),
      notes: str(formData.get("notes")),
      amount: amountRaw === null ? current.amount : num(amountRaw),
      amountLabel: str(formData.get("amountLabel")),
      laborLabel: str(formData.get("laborLabel")),
      laborAmount: num(formData.get("laborAmount")),
      equipmentLabel: str(formData.get("equipmentLabel")),
      equipmentAmount: num(formData.get("equipmentAmount")),
      freightAmount: num(formData.get("freightAmount")),
      deadline: str(formData.get("deadline")),
      fabricationDeadline: str(formData.get("fabricationDeadline")),
      schedule: str(formData.get("schedule")),
      paymentTerms: str(formData.get("paymentTerms")),
      taxes: str(formData.get("taxes")),
      unloading: str(formData.get("unloading")),
      surfaceTreatment: str(formData.get("surfaceTreatment")),
      colors: str(formData.get("colors")),
      floorNote: str(formData.get("floorNote")),
      warranty: str(formData.get("warranty")),
      purchaseConfirmation: str(formData.get("purchaseConfirmation")),
      ncm: str(formData.get("ncm")),
      validityDays: Math.max(1, int(formData.get("validityDays"))),
      signedBy: str(formData.get("signedBy")),
      signerPhone: str(formData.get("signerPhone")),
      signerEmail: str(formData.get("signerEmail")),
    },
  });
  await logAudit({ action: "UPDATE", entity: "Proposta", entityId: id, summary: "Proposta editada" });

  revalidatePath(`/proposals/${id}`);
  revalidatePath(`/leads/${current.leadId}`);
}

// Aplica o texto padrão do tipo escolhido, descartando o texto atual.
export async function resetProposalTemplate(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const current = await prisma.proposal.findUnique({ where: { id } });
  if (!current || !(await canEditLead(current.leadId))) return;

  const type = asEnum(PROPOSAL_TYPES, formData.get("type"), current.type);
  const t = proposalTemplate(type);
  await prisma.proposal.update({
    where: { id },
    data: {
      type,
      title: t.title,
      greeting: GREETING_PADRAO,
      intro: t.intro,
      scope: t.scope,
      included: t.included,
      notes: t.notes,
      amountLabel: t.amountLabel,
      laborLabel: t.laborLabel ?? null,
      equipmentLabel: t.equipmentLabel ?? null,
      deadline: t.deadline,
      fabricationDeadline: t.fabricationDeadline ?? null,
      schedule: t.schedule ?? null,
      paymentTerms: t.paymentTerms,
      taxes: t.taxes,
      unloading: t.unloading ?? null,
      surfaceTreatment: t.surfaceTreatment ?? null,
      colors: t.colors ?? null,
      floorNote: t.floorNote ?? null,
      warranty: t.warranty ?? null,
      purchaseConfirmation: t.purchaseConfirmation ?? null,
      ncm: t.ncm ?? null,
    },
  });

  revalidatePath(`/proposals/${id}`);
}

export async function deleteProposal(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const current = await prisma.proposal.findUnique({ where: { id } });
  if (!current || !(await canEditLead(current.leadId))) return;

  await prisma.proposal.delete({ where: { id } });
  await logAudit({ action: "DELETE", entity: "Proposta", entityId: id, summary: `Proposta R${current.revision} excluída` });

  revalidatePath(`/leads/${current.leadId}`);
  redirect(`/leads/${current.leadId}`);
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number {
  return parseMoney(v);
}
function int(v: FormDataEntryValue | null): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 10;
}
