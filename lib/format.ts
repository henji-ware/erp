// Helpers de formatação e rótulos compartilhados pela UI.

// Valida um valor recebido (FormData/string) contra uma lista fechada de
// opções. Retorna o valor com o tipo literal (compatível com os enums do
// Prisma) ou o fallback. Centraliza a checagem de status/tipo/etapa.
export function asEnum<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  const s = String(value ?? "").trim();
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

// ---- Produtos / Serviços ----
export const PRODUCT_KIND_LABELS: Record<string, string> = {
  PRODUCT: "Produto",
  SERVICE: "Serviço",
};

// ---- Projetos / Obras ----
export const PROJECT_TYPES = [
  "ENGENHARIA",
  "INSPECAO",
  "MONTAGEM",
  "REMANEJAMENTO",
  "MANUTENCAO",
  "VENDA",
  "LOCACAO",
] as const;

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  ENGENHARIA: "Engenharia / Projeto",
  INSPECAO: "Inspeção / Laudo",
  MONTAGEM: "Montagem",
  REMANEJAMENTO: "Remanejamento",
  MANUTENCAO: "Manutenção",
  VENDA: "Venda",
  LOCACAO: "Locação",
};

// Tipos oferecidos no formulário de projeto. Inspeção, Manutenção, Venda e
// Locação têm módulos próprios (na barra lateral), então ficam fora daqui
// para não duplicar. Os demais (PROJECT_TYPES) seguem válidos no banco.
export const PROJECT_TYPE_OPTIONS = ["ENGENHARIA", "MONTAGEM", "REMANEJAMENTO"] as const;

export const PROJECT_STATUSES = [
  "ORCAMENTO",
  "APROVADO",
  "EM_EXECUCAO",
  "CONCLUIDO",
  "CANCELADO",
] as const;

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ORCAMENTO: "Orçamento",
  APROVADO: "Aprovado",
  EM_EXECUCAO: "Em execução",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  ORCAMENTO: "bg-slate-100 text-slate-700",
  APROVADO: "bg-blue-100 text-blue-700",
  EM_EXECUCAO: "bg-amber-100 text-amber-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
};

// ---- Inspeções e Laudos ----
export const INSPECTION_STATUSES = ["AGENDADA", "REALIZADA", "LAUDO_EMITIDO"] as const;
export const INSPECTION_STATUS_LABELS: Record<string, string> = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  LAUDO_EMITIDO: "Laudo emitido",
};
export const INSPECTION_STATUS_COLORS: Record<string, string> = {
  AGENDADA: "bg-blue-100 text-blue-700",
  REALIZADA: "bg-amber-100 text-amber-700",
  LAUDO_EMITIDO: "bg-green-100 text-green-700",
};

// Classificação de risco por cores (padrão DRR / NR-11)
export const RISK_LEVELS = ["VERDE", "AMARELO", "VERMELHO"] as const;
export const RISK_LABELS: Record<string, string> = {
  VERDE: "Verde (sem risco)",
  AMARELO: "Amarelo (atenção)",
  VERMELHO: "Vermelho (crítico)",
};
export const RISK_COLORS: Record<string, string> = {
  VERDE: "bg-green-100 text-green-700",
  AMARELO: "bg-amber-100 text-amber-700",
  VERMELHO: "bg-red-100 text-red-700",
};

// ---- Agendamentos ----
export const APPOINTMENT_TYPES = ["VISIT", "MEETING"] as const;
export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  VISIT: "Visita",
  MEETING: "Reunião",
};

export const APPOINTMENT_STATUSES = ["SCHEDULED", "DONE", "CANCELLED"] as const;
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
};
export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// ---- Funil de leads ----
export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  PROPOSAL: "Proposta",
  WON: "Ganho",
  LOST: "Perdido",
};

export const LEAD_STAGE_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  PROPOSAL: "bg-amber-100 text-amber-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
};

// ---- Pedidos ----
export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "INVOICED",
  "CANCELLED",
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  INVOICED: "Faturado",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  INVOICED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// ---- Financeiro ----
export const TX_TYPES = ["RECEIVABLE", "PAYABLE"] as const;
export const TX_STATUSES = ["PENDING", "PARTIAL", "PAID"] as const;

export const TX_TYPE_LABELS: Record<string, string> = {
  RECEIVABLE: "A receber",
  PAYABLE: "A pagar",
};

export const TX_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
};

export const TX_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
};

// ---- Formas de pagamento ----
export const PAYMENT_METHODS = [
  "CARD_CREDIT",
  "CARD_DEBIT",
  "PIX",
  "BOLETO",
  "CASH",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD_CREDIT: "Cartão de crédito",
  CARD_DEBIT: "Cartão de débito",
  PIX: "Pix",
  BOLETO: "Boleto",
  CASH: "Dinheiro",
};

// ---- Locação ----
export const RENTAL_STATUSES = ["ACTIVE", "RETURNED", "OVERDUE", "CANCELLED"] as const;
export const RENTAL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Em locação",
  RETURNED: "Devolvido",
  OVERDUE: "Atrasado",
  CANCELLED: "Cancelado",
};
export const RENTAL_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  RETURNED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

// ---- Contratos de manutenção ----
export const MAINTENANCE_FREQUENCIES = [
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
] as const;
export const MAINTENANCE_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};
// Intervalo em dias aproximado de cada frequência (para calcular a próxima visita).
export const MAINTENANCE_FREQUENCY_DAYS: Record<string, number> = {
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
  SEMIANNUAL: 180,
  ANNUAL: 365,
};
export const MAINTENANCE_STATUSES = ["ACTIVE", "PAUSED", "ENDED"] as const;
export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ENDED: "Encerrado",
};
export const MAINTENANCE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  ENDED: "bg-slate-100 text-slate-600",
};

// Nome do ícone correspondente (componente Icon)
export const PAYMENT_METHOD_ICONS: Record<string, "card" | "pix" | "boleto" | "cash"> = {
  CARD_CREDIT: "card",
  CARD_DEBIT: "card",
  PIX: "pix",
  BOLETO: "boleto",
  CASH: "cash",
};
