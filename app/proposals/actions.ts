"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { asEnum } from "@/lib/format";
import { PROPOSAL_TYPES, proposalTemplate, PROPOSAL_TYPE_LABELS } from "@/lib/proposals";

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
      intro: previous?.intro ?? t.intro,
      scope: previous?.scope ?? t.scope,
      included: previous?.included ?? t.included,
      notes: previous?.notes ?? t.notes,
      amount: previous?.amount ?? lead.value,
      amountLabel: previous?.amountLabel ?? t.amountLabel,
      deadline: previous?.deadline ?? t.deadline,
      paymentTerms: previous?.paymentTerms ?? t.paymentTerms,
      taxes: previous?.taxes ?? t.taxes,
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
      intro: String(formData.get("intro") ?? ""),
      scope: String(formData.get("scope") ?? ""),
      included: str(formData.get("included")),
      notes: str(formData.get("notes")),
      amount: num(formData.get("amount")),
      amountLabel: str(formData.get("amountLabel")),
      deadline: str(formData.get("deadline")),
      paymentTerms: str(formData.get("paymentTerms")),
      taxes: str(formData.get("taxes")),
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
      intro: t.intro,
      scope: t.scope,
      included: t.included,
      notes: t.notes,
      amountLabel: t.amountLabel,
      deadline: t.deadline,
      paymentTerms: t.paymentTerms,
      taxes: t.taxes,
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
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function int(v: FormDataEntryValue | null): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 10;
}
