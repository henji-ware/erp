"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { asEnum, LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_LOSS_REASONS } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { isValidDocument, normalizeDocument } from "@/lib/document";
import { parseMoney } from "@/lib/money";

// Usuário comum só pode mexer nos próprios orçamentos; admin em todos.
async function canEditLead(id: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (isAdmin(user)) return true;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerId: true } });
  return !!lead && lead.ownerId === user?.id;
}

// Numeração das obras no padrão da DRR: AA + sequencial de 3 dígitos, onde AA
// é o ano de abertura e o sequencial é CONTÍNUO — não reinicia a cada ano nem
// a cada mês (ex.: 25177, 25178, 26179, 26180…).
const LEAD_COUNTER_KEY = "obra";

// Última obra numerada fora do sistema (26193). O primeiro orçamento criado
// aqui continua a partir dela.
const LEAD_NUMBER_START = 194;

async function nextLeadNumber(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(2);
  const counter = await prisma.counter.upsert({
    where: { key: LEAD_COUNTER_KEY },
    create: { key: LEAD_COUNTER_KEY, value: LEAD_NUMBER_START },
    update: { value: { increment: 1 } },
  });
  return `${yy}${String(counter.value).padStart(3, "0")}`;
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
      document: doc(formData.get("document")),
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

  // Com itens cadastrados, o valor vem da soma deles (campo fica travado na UI).
  const itemCount = await prisma.leadItem.count({ where: { leadId: id } });

  await prisma.lead.update({
    where: { id },
    data: {
      name,
      email: str(formData.get("email")),
      phone: str(formData.get("phone")),
      document: doc(formData.get("document")),
      source: str(formData.get("source")),
      ...(itemCount === 0 ? { value: num(formData.get("value")) } : {}),
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

// ---- Itens do orçamento ----

// Recalcula o valor do orçamento a partir dos itens (quando houver itens).
async function recalcLeadValue(leadId: number) {
  const items = await prisma.leadItem.findMany({ where: { leadId } });
  if (items.length === 0) return;
  const total = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  await prisma.lead.update({ where: { id: leadId }, data: { value: total } });
}

export async function addLeadItem(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  if (!leadId || !(await canEditLead(leadId))) return;

  const productId = Number(formData.get("productId")) || null;
  const quantity = Math.max(1, parseInt(String(formData.get("quantity") ?? "1"), 10) || 1);
  let description = String(formData.get("description") ?? "").trim();
  let unitPrice = num(formData.get("unitPrice"));

  // Item do catálogo: puxa nome e preço quando não informados.
  if (productId) {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) return;
    if (!description) description = p.name;
    if (!unitPrice) unitPrice = p.price;
  }
  if (!description) return;

  await prisma.leadItem.create({
    data: { leadId, productId, description, quantity, unitPrice },
  });
  await recalcLeadValue(leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function deleteLeadItem(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  const item = await prisma.leadItem.findUnique({ where: { id } });
  if (!item || !(await canEditLead(item.leadId))) return;

  await prisma.leadItem.delete({ where: { id } });
  await recalcLeadValue(item.leadId);

  revalidatePath(`/leads/${item.leadId}`);
  revalidatePath("/leads");
}

// Duplica um orçamento (com os itens) num novo, com número próprio.
// Útil para propostas parecidas — evita redigitar tudo.
export async function duplicateLead(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id || !(await canEditLead(id))) return;

  const source = await prisma.lead.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!source) return;

  const user = await getCurrentUser();
  const copy = await prisma.lead.create({
    data: {
      number: await nextLeadNumber(),
      name: `${source.name} (cópia)`,
      email: source.email,
      phone: source.phone,
      document: source.document,
      source: source.source,
      value: source.value,
      customerId: source.customerId,
      stage: "NEW",
      ownerId: user?.id ?? source.ownerId,
      shared: source.shared,
      items: {
        create: source.items.map((it) => ({
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      },
    },
  });
  await logAudit({
    action: "CREATE",
    entity: "Orçamento",
    entityId: copy.id,
    summary: `Duplicado do orçamento ${source.number ?? id}`,
  });

  revalidatePath("/leads");
  redirect(`/leads/${copy.id}`);
}

// ---- Fechar negócio ----

// Garante um cliente para o orçamento: usa o vinculado ou cria a partir dos
// dados do próprio orçamento (e deixa o vínculo salvo).
async function ensureCustomer(leadId: number): Promise<number | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  if (lead.customerId) return lead.customerId;

  const customer = await prisma.customer.create({
    data: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      document: lead.document,
      ownerId: lead.ownerId,
      shared: lead.shared,
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { customerId: customer.id } });
  return customer.id;
}

// Cria o registro operacional (projeto ou pedido) já preenchido a partir do
// orçamento: cliente, valor/itens, código de origem e dono. Marca como Vendido.
export async function closeDeal(formData: FormData) {
  const leadId = Number(formData.get("leadId"));
  const target = String(formData.get("target") ?? "");
  if (!leadId || !(await canEditLead(leadId))) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { items: true },
  });
  if (!lead) return;

  // Valida antes de mexer no orçamento: pedido exige itens do catálogo.
  const orderItems = lead.items
    .filter((it) => it.productId)
    .map((it) => ({ productId: it.productId!, quantity: it.quantity, unitPrice: it.unitPrice }));
  if (target === "order" && orderItems.length === 0) {
    redirect(`/leads/${leadId}?deal=noitems`);
  }

  const customerId = await ensureCustomer(leadId);
  if (!customerId) return;

  // Fechar negócio implica orçamento vendido.
  if (lead.stage !== "WON") {
    await prisma.lead.update({ where: { id: leadId }, data: { stage: "WON" } });
  }

  let destination = `/leads/${leadId}`;

  if (target === "project") {
    const project = await prisma.project.create({
      data: {
        number: "PRJ-" + Date.now().toString(36).toUpperCase(),
        title: lead.name,
        type: "ENGENHARIA",
        status: "APROVADO",
        customerId,
        value: lead.value,
        refCode: lead.number,
        ownerId: lead.ownerId,
        shared: lead.shared,
        notes: `Gerado do orçamento ${lead.number ?? ""}`.trim(),
      },
    });
    await logAudit({ action: "CREATE", entity: "Projeto", entityId: project.id, summary: `Projeto criado do orçamento ${lead.number ?? leadId}` });
    destination = `/projects/${project.id}`;
    revalidatePath("/projects");
  } else if (target === "order") {
    // Só itens ligados ao catálogo viram linhas do pedido (validado acima).
    const items = orderItems;
    const total = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const order = await prisma.order.create({
      data: {
        number: "PED-" + Date.now().toString(36).toUpperCase(),
        customerId,
        status: "DRAFT",
        total,
        refCode: lead.number,
        ownerId: lead.ownerId,
        shared: lead.shared,
        items: { create: items },
      },
    });
    await logAudit({ action: "CREATE", entity: "Pedido", entityId: order.id, summary: `Pedido criado do orçamento ${lead.number ?? leadId}` });
    destination = "/orders";
    revalidatePath("/orders");
  } else {
    return;
  }

  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/");
  redirect(destination);
}

// Converte um lead ganho em cliente do CRM (unificação CRM ↔ cadastro).
export async function convertLeadToCustomer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  if (!(await canEditLead(id))) return;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!lead) return;

  const user = await getCurrentUser();
  // Já vinculado a um cliente: reaproveita em vez de criar um cadastro duplicado.
  const customer =
    lead.customer ??
    (await prisma.customer.create({
      data: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        document: lead.document,
        // Herda o dono do orçamento (senão quem converteu não veria o cliente).
        ownerId: lead.ownerId ?? user?.id ?? null,
        shared: lead.shared,
      },
    }));

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
// CPF/CNPJ: descarta documento inválido (o formulário já avisa o usuário).
function doc(v: FormDataEntryValue | null): string | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  return isValidDocument(raw) ? normalizeDocument(raw) : null;
}
function num(v: FormDataEntryValue | null): number {
  return parseMoney(v);
}
