// Execução das ações do DeskHelper AI — lado servidor.
//
// PRINCÍPIO: nada que vem do modelo é confiável. O bloco de ação é só uma
// SUGESTÃO de preenchimento; aqui tudo é validado de novo, e os campos que
// decidem permissão ou dinheiro NÃO são lidos do modelo:
//
//   - ownerId vem sempre da sessão, nunca do JSON;
//   - preço de item vem do catálogo, nunca do JSON;
//   - status é fixado no valor mais inofensivo (rascunho/pendente);
//   - toda referência (cliente, produto, fornecedor) é buscada no banco e
//     conferida contra o escopo do usuário — pedir o id de um cliente de
//     outro vendedor devolve erro, não o registro.
//
// A gravação só acontece depois de um clique humano em /api/ai/action.

import { prisma } from "@/lib/prisma";
import { canSee, isAdmin, type CurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { roundMoney, splitMoney } from "@/lib/money";
import { normalizeDocument } from "@/lib/document";
import { APPOINTMENT_TYPES, RISK_LEVELS, TX_TYPES, formatCurrency } from "@/lib/format";
import { parseModelEnum, parseModelId, parseModelMoney } from "./parse-input";
import type { AIActionKind } from "./action-protocol";

/* ------------------------------------------------------------------ */
/* Limites                                                             */
/* ------------------------------------------------------------------ */

const MAX_SHORT = 160; // nome, título, local…
const MAX_LONG = 2000; // observações, constatações

/**
 * Teto de sanidade. Não é regra de negócio: é para um zero a mais do modelo
 * não virar um título de milhões esperando confirmação distraída.
 */
const MAX_MONEY = 5_000_000;
const MAX_ORDER_ITEMS = 30;
const MAX_INSTALLMENTS = 60;
const MAX_ITEM_QTY = 9999;

export type ActionOutcome =
  | { ok: true; entity: string; id: number; summary: string; href: string }
  | { ok: false; error: string };

const fail = (error: string): ActionOutcome => ({ ok: false, error });

/* ------------------------------------------------------------------ */
/* Validadores                                                         */
/* ------------------------------------------------------------------ */

function text(v: unknown, max = MAX_SHORT): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function requiredText(
  v: unknown,
  field: string,
  max = MAX_SHORT,
): { value: string } | { error: string } {
  const s = text(v, max);
  if (!s) return { error: `O campo "${field}" é obrigatório.` };
  return { value: s };
}

function money(v: unknown): { value: number } | { error: string } {
  // parseModelMoney entende "48.000,00" e "1,234.56" e RECUSA texto — ver
  // lib/ai/parse-input.ts. Usar o parseMoney das telas aqui lia "48.000,00"
  // como 48, e "a combinar" como 0.
  const n = parseModelMoney(v);
  if (n === null || n < 0) return { error: "Valor monetário inválido." };
  if (n > MAX_MONEY) {
    return {
      error: `Valor acima do limite permitido para criação por IA (${formatCurrency(
        MAX_MONEY,
      )}). Crie pela tela do módulo.`,
    };
  }
  return { value: roundMoney(n) };
}

/**
 * Aceita "2026-03-14" e "2026-03-14T09:30". Data sem hora cai às 09:00,
 * horário comercial — meia-noite faria uma inspeção "de hoje" nascer já
 * marcada como vencida.
 */
function when(v: unknown): { value: Date } | { error: string } {
  if (typeof v !== "string") return { error: "Data inválida." };
  const s = v.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? `${s}T09:00:00` : s);
  if (Number.isNaN(d.getTime())) return { error: `Data inválida: "${s}".` };
  const year = d.getFullYear();
  if (year < 2000 || year > 2100) {
    return { error: "Data fora de um intervalo plausível." };
  }
  return { value: d };
}

/** Inteiro simples (quantidade, parcelas) — não é id de registro. */
function positiveInt(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

/* ------------------------------------------------------------------ */
/* Resolução de referências (sempre contra o escopo do usuário)        */
/* ------------------------------------------------------------------ */

/**
 * O modelo pode alucinar um id — ou repetir um que viu num contexto antigo.
 * Aqui o registro é buscado e passado por canSee: se o usuário não teria
 * acesso a ele na tela, também não tem por aqui. A mensagem de erro é a
 * mesma nos dois casos ("não encontrado"), para não virar um oráculo que
 * confirma quais ids existem.
 */
async function resolveCustomer(
  v: unknown,
  user: CurrentUser,
  required: boolean,
): Promise<{ value: number | null } | { error: string }> {
  // parseModelId separa "não informado" (null) de "informado e inválido"
  // (undefined). Antes os dois caíam no mesmo caminho: "clienteId": "ACME
  // Ltda" criava o registro SEM cliente, enquanto o cartão exibia o nome.
  const id = parseModelId(v);
  if (id === undefined) {
    return { error: `Cliente inválido: "${String(v)}". Use o id numérico da lista.` };
  }
  if (id === null) {
    return required ? { error: "Informe o cliente (campo clienteId)." } : { value: null };
  }
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, ownerId: true, shared: true },
  });
  if (!customer || !canSee(user, customer)) {
    return { error: `Cliente ${id} não encontrado.` };
  }
  return { value: customer.id };
}

async function resolveSupplier(
  v: unknown,
): Promise<{ value: number | null } | { error: string }> {
  const id = parseModelId(v);
  if (id === undefined) {
    return { error: `Fornecedor inválido: "${String(v)}". Use o id numérico da lista.` };
  }
  if (id === null) return { value: null };
  const supplier = await prisma.supplier.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!supplier) return { error: `Fornecedor ${id} não encontrado.` };
  return { value: supplier.id };
}

async function resolveEmployee(
  v: unknown,
): Promise<{ value: number | null } | { error: string }> {
  const id = parseModelId(v);
  if (id === undefined) {
    return { error: `Funcionário inválido: "${String(v)}". Use o id numérico da lista.` };
  }
  if (id === null) return { value: null };
  const employee = await prisma.employee.findFirst({
    where: { id, active: true },
    select: { id: true },
  });
  if (!employee) return { error: `Funcionário ${id} não encontrado ou inativo.` };
  return { value: employee.id };
}

/* ------------------------------------------------------------------ */
/* Numeração de orçamento (mesma regra da tela de Leads)               */
/* ------------------------------------------------------------------ */

const LEAD_COUNTER_KEY = "obra";
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

/* ------------------------------------------------------------------ */
/* Permissão por tipo de ação                                          */
/* ------------------------------------------------------------------ */

/**
 * Lançamento financeiro e pedido só por administrador. Um vendedor continua
 * criando orçamento, cliente, inspeção e agendamento pelo chat — o que mexe
 * em caixa e estoque fica com quem já tem essa alçada nas telas.
 */
export function canRunAction(kind: AIActionKind, user: CurrentUser): boolean {
  if (kind === "criar_lancamento" || kind === "criar_pedido") return isAdmin(user);
  return true;
}

/* ------------------------------------------------------------------ */
/* Execução                                                            */
/* ------------------------------------------------------------------ */

export async function executeAIAction(
  kind: AIActionKind,
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  if (!canRunAction(kind, user)) {
    return fail("Esta ação é restrita a administradores.");
  }

  switch (kind) {
    case "criar_cliente":
      return createCustomerAction(data, user);
    case "criar_orcamento":
      return createLeadAction(data, user);
    case "criar_inspecao":
      return createInspectionAction(data, user);
    case "criar_agendamento":
      return createAppointmentAction(data, user);
    case "criar_lancamento":
      return createTransactionAction(data, user);
    case "criar_pedido":
      return createOrderAction(data, user);
  }
}

async function createCustomerAction(
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  const name = requiredText(data.nome, "nome");
  if ("error" in name) return fail(name.error);

  const customer = await prisma.customer.create({
    data: {
      name: name.value,
      email: text(data.email),
      phone: text(data.telefone),
      company: text(data.empresa),
      document: normalizeDocument(text(data.documento)),
      address: text(data.endereco, MAX_LONG),
      notes: text(data.observacoes, MAX_LONG),
      ownerId: user.id,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "Cliente",
    entityId: customer.id,
    summary: `[IA] Cliente "${customer.name}" criado`,
  });

  return {
    ok: true,
    entity: "Cliente",
    id: customer.id,
    summary: customer.name,
    href: `/customers/${customer.id}`,
  };
}

async function createLeadAction(
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  const name = requiredText(data.nome, "nome");
  if ("error" in name) return fail(name.error);

  const value = money(data.valor ?? 0);
  if ("error" in value) return fail(value.error);

  const customerId = await resolveCustomer(data.clienteId, user, false);
  if ("error" in customerId) return fail(customerId.error);

  const lead = await prisma.lead.create({
    data: {
      number: await nextLeadNumber(),
      name: name.value,
      email: text(data.email),
      phone: text(data.telefone),
      document: normalizeDocument(text(data.documento)),
      source: text(data.origem),
      value: value.value,
      // Nasce no início do funil: quem move de etapa é uma pessoa.
      stage: "NEW",
      customerId: customerId.value,
      ownerId: user.id,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "Orçamento",
    entityId: lead.id,
    summary: `[IA] Orçamento ${lead.number} "${lead.name}" criado`,
  });

  return {
    ok: true,
    entity: "Orçamento",
    id: lead.id,
    summary: `${lead.number} · ${lead.name}`,
    href: `/leads/${lead.id}`,
  };
}

async function createInspectionAction(
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  const customerId = await resolveCustomer(data.clienteId, user, true);
  if ("error" in customerId) return fail(customerId.error);

  const scheduledAt = when(data.inicio ?? data.data);
  if ("error" in scheduledAt) return fail(scheduledAt.error);

  // asEnum(..., "VERDE") transformava "ALTO" no risco MAIS BAIXO em silêncio,
  // com o cartão exibindo "ALTO". Num laudo estrutural isso é o pior tipo de
  // erro: o registro contradiz o que a pessoa aprovou, e ninguém vê.
  let riskLevel: (typeof RISK_LEVELS)[number] | null = null;
  if (data.nivelRisco !== undefined && data.nivelRisco !== null && data.nivelRisco !== "") {
    const parsed = parseModelEnum(data.nivelRisco, RISK_LEVELS, {
      BAIXO: "VERDE",
      VERDE_BAIXO: "VERDE",
      MEDIO: "AMARELO",
      "MÉDIO": "AMARELO",
      MODERADO: "AMARELO",
      ALTO: "VERMELHO",
      CRITICO: "VERMELHO",
      "CRÍTICO": "VERMELHO",
      GRAVE: "VERMELHO",
    });
    if (!parsed) {
      return fail(
        `Nível de risco inválido: "${String(data.nivelRisco)}". Use VERDE, AMARELO ou VERMELHO.`,
      );
    }
    riskLevel = parsed;
  }

  const inspection = await prisma.inspection.create({
    data: {
      customerId: customerId.value!,
      scheduledAt: scheduledAt.value,
      // O laudo nasce AGENDADO. Concluir uma inspeção é ato técnico de quem
      // foi a campo — não pode sair de um chat.
      status: "AGENDADA",
      location: text(data.local),
      engineer: text(data.engenheiro),
      artNumber: text(data.art),
      riskLevel,
      findings: text(data.constatacoes, MAX_LONG),
      refCode: text(data.referencia),
      ownerId: user.id,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "Inspeção",
    entityId: inspection.id,
    summary: "[IA] Inspeção agendada",
  });

  return {
    ok: true,
    entity: "Inspeção",
    id: inspection.id,
    summary: "Inspeção agendada",
    href: `/inspections/${inspection.id}`,
  };
}

async function createAppointmentAction(
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  const title = requiredText(data.titulo, "titulo");
  if ("error" in title) return fail(title.error);

  const startsAt = when(data.inicio);
  if ("error" in startsAt) return fail(startsAt.error);

  const customerId = await resolveCustomer(data.clienteId, user, false);
  if ("error" in customerId) return fail(customerId.error);

  const employeeId = await resolveEmployee(data.funcionarioId);
  if ("error" in employeeId) return fail(employeeId.error);

  // Campo ausente vira reunião (é o padrão da tela); valor DESCONHECIDO vira
  // erro, para o cartão não dizer "visita" e o registro guardar "reunião".
  const appointmentType =
    data.tipo === undefined || data.tipo === null || data.tipo === ""
      ? "MEETING"
      : parseModelEnum(data.tipo, APPOINTMENT_TYPES, {
          VISITA: "VISIT",
          REUNIAO: "MEETING",
          "REUNIÃO": "MEETING",
        });
  if (!appointmentType) {
    return fail(`Tipo de agendamento inválido: "${String(data.tipo)}". Use VISIT ou MEETING.`);
  }

  const appointment = await prisma.appointment.create({
    data: {
      title: title.value,
      type: appointmentType,
      startsAt: startsAt.value,
      location: text(data.local),
      notes: text(data.observacoes, MAX_LONG),
      customerId: customerId.value,
      employeeId: employeeId.value,
      status: "SCHEDULED",
      ownerId: user.id,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "Agendamento",
    entityId: appointment.id,
    summary: `[IA] "${appointment.title}" agendado`,
  });

  return {
    ok: true,
    entity: "Agendamento",
    id: appointment.id,
    summary: appointment.title,
    href: `/appointments/${appointment.id}`,
  };
}

async function createTransactionAction(
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  const description = requiredText(data.descricao, "descricao");
  if ("error" in description) return fail(description.error);

  // Sem fallback: `data.tipo === "PAYABLE" ? ... : "RECEIVABLE"` transformava
  // "pagar", "A_PAGAR" ou o campo ausente numa conta A RECEBER — o cartão
  // mostrava o que o modelo escreveu e o caixa registrava o sentido oposto.
  const type = parseModelEnum(data.tipo, TX_TYPES, {
    PAGAR: "PAYABLE",
    A_PAGAR: "PAYABLE",
    "A PAGAR": "PAYABLE",
    DESPESA: "PAYABLE",
    RECEBER: "RECEIVABLE",
    A_RECEBER: "RECEIVABLE",
    "A RECEBER": "RECEIVABLE",
    RECEITA: "RECEIVABLE",
  });
  if (!type) {
    return fail('Informe o tipo do lançamento: "RECEIVABLE" (a receber) ou "PAYABLE" (a pagar).');
  }

  const amount = money(data.valor);
  if ("error" in amount) return fail(amount.error);
  if (amount.value <= 0) return fail("Informe um valor maior que zero.");

  const dueDate = when(data.vencimento);
  if ("error" in dueDate) return fail(dueDate.error);

  const parts = positiveInt(data.parcelas ?? 1, MAX_INSTALLMENTS);
  if (!parts) {
    return fail(`Número de parcelas deve ficar entre 1 e ${MAX_INSTALLMENTS}.`);
  }

  const customerId =
    type === "RECEIVABLE"
      ? await resolveCustomer(data.clienteId, user, false)
      : { value: null as number | null };
  if ("error" in customerId) return fail(customerId.error);

  const supplierId =
    type === "PAYABLE"
      ? await resolveSupplier(data.fornecedorId)
      : { value: null as number | null };
  if ("error" in supplierId) return fail(supplierId.error);

  const tx = await prisma.transaction.create({
    data: {
      description: description.value,
      type,
      amount: amount.value,
      dueDate: dueDate.value,
      // Sempre em aberto: dar baixa é registrar que dinheiro entrou ou saiu,
      // e isso nunca deve acontecer por sugestão de um modelo.
      status: "PENDING",
      customerId: customerId.value,
      supplierId: supplierId.value,
      ownerId: user.id,
    },
  });

  if (parts > 1) {
    const amounts = splitMoney(amount.value, parts);
    await prisma.installment.createMany({
      data: Array.from({ length: parts }, (_, i) => {
        const due = new Date(dueDate.value);
        due.setMonth(due.getMonth() + i);
        return {
          transactionId: tx.id,
          number: i + 1,
          amount: amounts[i],
          dueDate: due,
        };
      }),
    });
  }

  await logAudit({
    action: "CREATE",
    entity: "Lançamento",
    entityId: tx.id,
    summary: `[IA] ${
      type === "RECEIVABLE" ? "A receber" : "A pagar"
    } "${tx.description}" — ${formatCurrency(tx.amount)}`,
  });

  return {
    ok: true,
    entity: "Lançamento",
    id: tx.id,
    summary: `${tx.description} — ${formatCurrency(tx.amount)}`,
    href: `/finance/${tx.id}`,
  };
}

async function createOrderAction(
  data: Record<string, unknown>,
  user: CurrentUser,
): Promise<ActionOutcome> {
  const customerId = await resolveCustomer(data.clienteId, user, true);
  if ("error" in customerId) return fail(customerId.error);

  const rawItems = Array.isArray(data.itens) ? data.itens : [];
  if (rawItems.length === 0) return fail("Informe ao menos um item (campo itens).");
  if (rawItems.length > MAX_ORDER_ITEMS) {
    return fail(`Máximo de ${MAX_ORDER_ITEMS} itens por pedido criado via IA.`);
  }

  // Normaliza {produtoId, quantidade} e soma quantidades repetidas.
  const wanted = new Map<number, number>();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") return fail("Item de pedido inválido.");
    const item = raw as Record<string, unknown>;
    const productId = positiveInt(item.produtoId, Number.MAX_SAFE_INTEGER);
    const qty = positiveInt(item.quantidade ?? 1, MAX_ITEM_QTY);
    if (!productId) return fail("Cada item precisa de um produtoId válido.");
    if (!qty) return fail(`Quantidade inválida para o produto ${productId}.`);
    wanted.set(productId, (wanted.get(productId) ?? 0) + qty);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()] }, deletedAt: null },
    select: { id: true, price: true },
  });
  const found = new Set(products.map((p) => p.id));
  const missing = [...wanted.keys()].filter((id) => !found.has(id));
  if (missing.length > 0) {
    return fail(`Produto(s) não encontrado(s): ${missing.join(", ")}.`);
  }

  // O PREÇO VEM DO CATÁLOGO. Se viesse do JSON, bastaria o modelo errar (ou
  // ser induzido a errar) para gravar um pedido com um desconto que ninguém
  // aprovou.
  const items = products.map((p) => ({
    productId: p.id,
    quantity: wanted.get(p.id)!,
    unitPrice: p.price,
  }));
  const total = roundMoney(
    items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0),
  );

  const limit = money(total);
  if ("error" in limit) return fail(limit.error);

  const order = await prisma.order.create({
    data: {
      number: "PED-" + Date.now().toString(36).toUpperCase(),
      customerId: customerId.value!,
      // DRAFT sempre. Confirmar um pedido baixa estoque e gera cobrança —
      // esses efeitos só saem da tela de Pedidos, com uma pessoa olhando.
      // A IA prepara o rascunho; não fecha a venda.
      status: "DRAFT",
      total,
      deliveryAddress: text(data.endereco, MAX_LONG),
      refCode: text(data.referencia),
      items: { create: items },
      ownerId: user.id,
    },
  });

  await logAudit({
    action: "CREATE",
    entity: "Pedido",
    entityId: order.id,
    summary: `[IA] Pedido ${order.number} criado como rascunho — ${formatCurrency(total)}`,
  });

  return {
    ok: true,
    entity: "Pedido",
    id: order.id,
    summary: `${order.number} · ${formatCurrency(total)} (rascunho)`,
    href: "/orders",
  };
}
