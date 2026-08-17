import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { remaining } from "@/lib/finance";

export interface ERPContextData {
  stats: {
    totalCustomers: number;
    openLeadsCount: number;
    openLeadsValue: number;
    ordersCount: number;
    ordersRevenue: number;
    overdueReceivablesCount: number;
    overdueReceivablesValue: number;
    overduePayablesCount: number;
    overduePayablesValue: number;
    scheduledInspectionsCount: number;
    activeRentalsCount: number;
    lowStockCount: number;
  };
  recentLeads: Array<{
    number: string;
    name: string;
    stage: string;
    value: number;
    createdAt: string;
  }>;
  upcomingInspections: Array<{
    customer: string;
    date: string;
    location?: string;
    status: string;
  }>;
  overdueBills: Array<{
    type: "RECEIVABLE" | "PAYABLE";
    description: string;
    dueDate: string;
    amount: number;
    customerOrSupplier: string;
  }>;
  maintenanceContracts: Array<{
    customer: string;
    frequency: string;
    nextVisit?: string;
    value: number;
  }>;
}

export async function getERPContextForAI(): Promise<ERPContextData> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const [
    totalCustomers,
    openLeads,
    orders,
    receivables,
    payables,
    recentLeadsRaw,
    scheduledInspections,
    upcomingInspectionsRaw,
    activeRentals,
    lowStockProducts,
    maintenanceContractsRaw,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.lead.findMany({
      where: { deletedAt: null, stage: { notIn: ["WON", "LOST"] } },
      select: { value: true },
    }),
    prisma.order.findMany({
      where: { deletedAt: null, status: { not: "CANCELLED" } },
      select: { total: true },
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null, type: "RECEIVABLE", status: { not: "PAID" } },
      include: { payments: true, customer: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null, type: "PAYABLE", status: { not: "PAID" } },
      include: { payments: true, supplier: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { number: true, name: true, stage: true, value: true, createdAt: true },
    }),
    prisma.inspection.count({
      where: { deletedAt: null, status: "AGENDADA" },
    }),
    prisma.inspection.findMany({
      where: { deletedAt: null, status: "AGENDADA", scheduledAt: { gte: now, lte: in7Days } },
      take: 5,
      orderBy: { scheduledAt: "asc" },
      include: { customer: { select: { name: true } } },
    }),
    prisma.rental.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.product.count({
      where: { deletedAt: null, kind: "PRODUCT", stock: { lte: 5 } },
    }),
    prisma.maintenanceContract.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      take: 5,
      orderBy: { nextVisit: "asc" },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const openLeadsValue = openLeads.reduce((s, l) => s + l.value, 0);
  const ordersRevenue = orders.reduce((s, o) => s + o.total, 0);

  const overdueReceivables = receivables.filter((t) => t.dueDate < now);
  const overdueReceivablesValue = overdueReceivables.reduce((s, t) => s + remaining(t), 0);

  const overduePayables = payables.filter((t) => t.dueDate < now);
  const overduePayablesValue = overduePayables.reduce((s, t) => s + remaining(t), 0);

  const overdueBills = [
    ...overdueReceivables.map((t) => ({
      type: "RECEIVABLE" as const,
      description: t.description,
      dueDate: formatDate(t.dueDate),
      amount: remaining(t),
      customerOrSupplier: t.customer?.name || "Cliente não informado",
    })),
    ...overduePayables.map((t) => ({
      type: "PAYABLE" as const,
      description: t.description,
      dueDate: formatDate(t.dueDate),
      amount: remaining(t),
      customerOrSupplier: t.supplier?.name || "Fornecedor não informado",
    })),
  ];

  return {
    stats: {
      totalCustomers,
      openLeadsCount: openLeads.length,
      openLeadsValue,
      ordersCount: orders.length,
      ordersRevenue,
      overdueReceivablesCount: overdueReceivables.length,
      overdueReceivablesValue,
      overduePayablesCount: overduePayables.length,
      overduePayablesValue,
      scheduledInspectionsCount: scheduledInspections,
      activeRentalsCount: activeRentals.length,
      lowStockCount: lowStockProducts,
    },
    recentLeads: recentLeadsRaw.map((l) => ({
      number: l.number || "—",
      name: l.name,
      stage: l.stage,
      value: l.value,
      createdAt: formatDate(l.createdAt),
    })),
    upcomingInspections: upcomingInspectionsRaw.map((i) => ({
      customer: i.customer.name,
      date: formatDate(i.scheduledAt),
      location: i.location || undefined,
      status: i.status,
    })),
    overdueBills,
    maintenanceContracts: maintenanceContractsRaw.map((m) => ({
      customer: m.customer.name,
      frequency: m.frequency,
      nextVisit: m.nextVisit ? formatDate(m.nextVisit) : undefined,
      value: m.value,
    })),
  };
}

export function buildSystemPromptWithERPContext(
  context: ERPContextData,
  userName?: string
): string {
  return `Você é o Copilot de IA do ERP da DRR Projetos e Equipamentos.
A DRR é uma empresa especializada em estruturas de armazenagem logística (porta-paletes, mezaninos, gradil NR12, wire deck, vistorias técnicas com emissão de laudo e ART, montagem, manutenção periódica e locação de equipamentos tipo PTA).

Seu papel é responder com extrema clareza, tom executivo e prestativo, auxiliando administradores, vendedores e engenheiros com dados reais do sistema, ideias comerciais, elaboração de mensagens de follow-up e estratégias de negócios.

DADOS CONSOLIDADOS DO SISTEMA EM TEMPO REAL:
- Usuário atual: ${userName || "Colaborador DRR"}
- Clientes Cadastrados: ${context.stats.totalCustomers}
- Orçamentos/Leads em Aberto: ${context.stats.openLeadsCount} (Total em Pipeline: ${formatCurrency(context.stats.openLeadsValue)})
- Pedidos Faturados/Confirmados: ${context.stats.ordersCount} (Faturamento Total: ${formatCurrency(context.stats.ordersRevenue)})
- Contas a Receber Vencidas: ${context.stats.overdueReceivablesCount} (${formatCurrency(context.stats.overdueReceivablesValue)})
- Contas a Pagar Vencidas: ${context.stats.overduePayablesCount} (${formatCurrency(context.stats.overduePayablesValue)})
- Inspeções Agendadas: ${context.stats.scheduledInspectionsCount}
- Contratos de Locação Ativos: ${context.stats.activeRentalsCount}
- Itens com Estoque Baixo (≤ 5 un): ${context.stats.lowStockCount}

ÚLTIMOS ORÇAMENTOS REGISTRADOS:
${context.recentLeads.map((l) => `- Nº ${l.number}: ${l.name} | Etapa: ${l.stage} | Valor: ${formatCurrency(l.value)} | Data: ${l.createdAt}`).join("\n")}

CONTAS VENCIDAS (AMOSTRA):
${context.overdueBills.slice(0, 5).map((b) => `- [${b.type === "RECEIVABLE" ? "A RECEBER" : "A PAGAR"}] ${b.description} (${b.customerOrSupplier}): ${formatCurrency(b.amount)} - Vencimento: ${b.dueDate}`).join("\n")}

INSPEÇÕES PRÓXIMAS (≤ 7 DIAS):
${context.upcomingInspections.length > 0 ? context.upcomingInspections.map((i) => `- Cliente: ${i.customer} | Data: ${i.date} ${i.location ? `| Local: ${i.location}` : ""}`).join("\n") : "Nenhuma inspeção agendada para os próximos 7 dias."}

DIRETRIZES DE RESPOSTA:
1. Responda em Português do Brasil de forma estruturada (use listas com marcadores, destaques em negrito e tabelas quando apropriado).
2. Se o usuário pedir um rascunho de e-mail ou WhatsApp (por exemplo, cobrança ou follow-up comercial), forneça um modelo pronto para copiar e colar com tom profissional e cordial.
3. Se o usuário perguntar sobre normas técnicas, cite as referências corretas (ex: ABNT NBR 15524 para estruturas porta-paletes, NR12 para segurança em máquinas e gradis, ART emitida por engenheiro responsável).
4. Seja sempre proativo, oferecendo próximos passos lógicos.`;
}
