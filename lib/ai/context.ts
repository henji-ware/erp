import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { remaining } from "@/lib/finance";
import { crmScope, isAdmin, type CurrentUser } from "@/lib/auth";

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
  /**
   * Ids reais para o modelo referenciar nas ações. Sem isto ele inventaria
   * números — e a validação do servidor rejeitaria tudo. É uma amostra, não
   * a base inteira (ver AMOSTRA_* abaixo).
   */
  catalog: {
    customers: Array<{ id: number; name: string }>;
    products: Array<{ id: number; name: string; price: number }>;
    suppliers: Array<{ id: number; name: string }>;
    employees: Array<{ id: number; name: string }>;
  };
}

// Quantos registros de cada tipo entram no prompt. Mais que isto engorda
// cada mensagem do chat sem melhorar a resposta.
const AMOSTRA_CLIENTES = 40;
const AMOSTRA_PRODUTOS = 40;
const AMOSTRA_APOIO = 15;

/**
 * Consolida o estado do ERP para injetar no prompt do DeskHelper.
 *
 * O `user` NÃO é opcional de propósito. Este contexto vira texto dentro do
 * prompt, e antes as consultas rodavam sem escopo: um vendedor que abrisse o
 * chat recebia o faturamento da empresa inteira e os títulos vencidos de
 * colegas — dados que as telas dele não mostram. Aqui vale o mesmo
 * `crmScope` das páginas.
 *
 * Produto/estoque continua global: o catálogo não tem dono, é o mesmo para
 * todo mundo (as páginas de produtos também não aplicam escopo).
 */
export async function getERPContextForAI(
  user: CurrentUser,
): Promise<ERPContextData> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const scope = crmScope(user);

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
    catalogCustomers,
    catalogProducts,
    catalogSuppliers,
    catalogEmployees,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null, ...scope } }),
    prisma.lead.findMany({
      where: { deletedAt: null, ...scope, stage: { notIn: ["WON", "LOST"] } },
      select: { value: true },
    }),
    prisma.order.findMany({
      where: { deletedAt: null, ...scope, status: { not: "CANCELLED" } },
      select: { total: true },
    }),
    // Só as vencidas: é o que o prompt usa, e carregar toda a carteira em
    // aberto (com os pagamentos de cada título) a cada mensagem do chat pesa
    // demais conforme a base cresce.
    prisma.transaction.findMany({
      where: { deletedAt: null, ...scope, type: "RECEIVABLE", status: { not: "PAID" }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 50,
      include: { payments: true, customer: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null, ...scope, type: "PAYABLE", status: { not: "PAID" }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 50,
      include: { payments: true, supplier: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ...scope },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { number: true, name: true, stage: true, value: true, createdAt: true },
    }),
    prisma.inspection.count({
      where: { deletedAt: null, ...scope, status: "AGENDADA" },
    }),
    prisma.inspection.findMany({
      where: { deletedAt: null, ...scope, status: "AGENDADA", scheduledAt: { gte: now, lte: in7Days } },
      take: 5,
      orderBy: { scheduledAt: "asc" },
      include: { customer: { select: { name: true } } },
    }),
    prisma.rental.findMany({
      where: { deletedAt: null, ...scope, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.product.count({
      where: { deletedAt: null, kind: "PRODUCT", stock: { lte: 5 } },
    }),
    prisma.maintenanceContract.findMany({
      where: { deletedAt: null, ...scope, status: "ACTIVE" },
      take: 5,
      orderBy: { nextVisit: "asc" },
      include: { customer: { select: { name: true } } },
    }),
    // --- ids para as ações ---
    prisma.customer.findMany({
      where: { deletedAt: null, ...scope },
      take: AMOSTRA_CLIENTES,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      take: AMOSTRA_PRODUTOS,
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      take: AMOSTRA_APOIO,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      where: { active: true },
      take: AMOSTRA_APOIO,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const openLeadsValue = openLeads.reduce((s, l) => s + l.value, 0);
  const ordersRevenue = orders.reduce((s, o) => s + o.total, 0);

  // A consulta já trouxe apenas os títulos vencidos.
  const overdueReceivables = receivables;
  const overdueReceivablesValue = overdueReceivables.reduce((s, t) => s + remaining(t), 0);

  const overduePayables = payables;
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
    catalog: {
      customers: catalogCustomers,
      products: catalogProducts,
      suppliers: catalogSuppliers,
      employees: catalogEmployees,
    },
  };
}

function listar(items: Array<{ id: number; name: string }>): string {
  if (items.length === 0) return "- (nenhum cadastrado)";
  return items.map((i) => `- ${i.id} — ${i.name}`).join("\n");
}

/**
 * Instruções do protocolo de ações.
 *
 * O modelo NÃO executa nada: ele descreve a ação num bloco ```drr-acao, a
 * tela transforma isso num cartão de confirmação e só o clique do usuário
 * grava. Por isso o prompt insiste em dois pontos: nunca dizer que já criou,
 * e nunca inventar id.
 */
function acoesDisponiveis(admin: boolean): string {
  const financeiras = admin
    ? `
- criar_lancamento — conta a receber ou a pagar
  dados: { "descricao": "...", "tipo": "RECEIVABLE" | "PAYABLE", "valor": 1500.00, "vencimento": "AAAA-MM-DD", "parcelas": 1, "clienteId": 12, "fornecedorId": 3 }
- criar_pedido — pedido de venda (nasce como RASCUNHO)
  dados: { "clienteId": 12, "itens": [{ "produtoId": 5, "quantidade": 2 }], "endereco": "...", "referencia": "..." }`
    : `
(Lançamento financeiro e pedido são restritos a administradores. Se este
usuário pedir, explique que ele precisa criar pela tela do módulo ou pedir a
um administrador — e NÃO emita bloco de ação para esses dois casos.)`;

  return `COMO CRIAR REGISTROS NO SISTEMA:
Quando — e somente quando — o usuário pedir explicitamente para CRIAR algo,
escreva uma frase curta confirmando o que será criado e, em seguida, um bloco:

\`\`\`drr-acao
{ "acao": "criar_orcamento", "dados": { "nome": "Mezanino - Cliente X", "valor": 48000 } }
\`\`\`

REGRAS INEGOCIÁVEIS:
- Você NÃO cria nada. O bloco vira um cartão e o usuário precisa clicar em
  "Criar". Nunca escreva "criei", "cadastrei" ou "pronto, está no sistema".
  Diga "revise e confirme abaixo".
- Um bloco por mensagem. Se o pedido envolve vários registros, faça o
  primeiro e ofereça o próximo depois da confirmação.
- NUNCA invente id. Use apenas os ids das listas acima. Se o cliente ou o
  produto não estiver na lista, diga isso e peça o nome exato — a lista é
  uma AMOSTRA, a base pode ter mais registros.
- Datas sempre no formato AAAA-MM-DD (ou AAAA-MM-DDTHH:mm quando houver hora).
- Valores em número puro, sem "R$" e sem separador de milhar.
- Campos que você não souber: omita. Não preencha com placeholder.

AÇÕES DISPONÍVEIS:
- criar_cliente
  dados: { "nome": "...", "email": "...", "telefone": "...", "empresa": "...", "documento": "CPF ou CNPJ", "endereco": "...", "observacoes": "..." }
- criar_orcamento — orçamento/lead (nasce na etapa Novo)
  dados: { "nome": "...", "valor": 48000, "clienteId": 12, "email": "...", "telefone": "...", "origem": "..." }
- criar_inspecao — inspeção/laudo (nasce AGENDADA)
  dados: { "clienteId": 12, "inicio": "AAAA-MM-DD", "local": "...", "engenheiro": "...", "art": "...", "nivelRisco": "VERDE" | "AMARELO" | "VERMELHO", "constatacoes": "...", "referencia": "nº do orçamento" }
- criar_agendamento
  dados: { "titulo": "...", "inicio": "AAAA-MM-DDTHH:mm", "tipo": "VISIT" | "MEETING", "clienteId": 12, "funcionarioId": 4, "local": "...", "observacoes": "..." }${financeiras}`;
}

export function buildSystemPromptWithERPContext(
  context: ERPContextData,
  user: CurrentUser,
): string {
  const admin = isAdmin(user);
  const userName = user.name;
  // O modelo precisa saber de que recorte vieram os números, senão diz
  // "o faturamento da DRR é X" para um vendedor que só enxerga a carteira
  // dele — e o número sai errado sem ninguém perceber.
  const escopo = admin
    ? "Você vê os dados de TODA a empresa (o usuário é administrador)."
    : "ATENÇÃO: os números abaixo são apenas do que ESTE usuário tem acesso " +
      "(registros dele e os compartilhados com a equipe), não da empresa " +
      "inteira. Nunca apresente estes valores como o total da DRR.";
  return `Você é o DeskHelper AI, assistente do ERP da DRR Projetos e Equipamentos.
A DRR é uma empresa especializada em estruturas de armazenagem logística (porta-paletes, mezaninos, gradil NR12, wire deck, vistorias técnicas com emissão de laudo e ART, montagem, manutenção periódica e locação de equipamentos tipo PTA).

Seu papel é responder com extrema clareza, tom executivo e prestativo, auxiliando administradores, vendedores e engenheiros com dados reais do sistema, ideias comerciais, elaboração de mensagens de follow-up e estratégias de negócios.

${escopo}

DADOS CONSOLIDADOS DO SISTEMA EM TEMPO REAL:
- Usuário atual: ${userName || "Colaborador DRR"} (${admin ? "Administrador" : "Colaborador"})
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

CLIENTES (id — nome), amostra de até ${AMOSTRA_CLIENTES}:
${listar(context.catalog.customers)}

PRODUTOS/SERVIÇOS (id — nome — preço), amostra de até ${AMOSTRA_PRODUTOS}:
${
  context.catalog.products
    .map((p) => `- ${p.id} — ${p.name} — ${formatCurrency(p.price)}`)
    .join("\n") || "- (nenhum cadastrado)"
}

FORNECEDORES (id — nome):
${listar(context.catalog.suppliers)}

EQUIPE (id — nome):
${listar(context.catalog.employees)}

${acoesDisponiveis(admin)}

DIRETRIZES DE RESPOSTA:
1. Responda em Português do Brasil de forma estruturada (use listas com marcadores, destaques em negrito e tabelas quando apropriado).
2. Se o usuário pedir um rascunho de e-mail ou WhatsApp (por exemplo, cobrança ou follow-up comercial), forneça um modelo pronto para copiar e colar com tom profissional e cordial.
3. Se o usuário perguntar sobre normas técnicas, cite as referências corretas (ex: ABNT NBR 15524 para estruturas porta-paletes, NR12 para segurança em máquinas e gradis, ART emitida por engenheiro responsável).
4. Seja sempre proativo, oferecendo próximos passos lógicos.`;
}
