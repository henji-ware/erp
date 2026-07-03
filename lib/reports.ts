import { OrderStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { remaining } from "./finance";
import { PAYMENT_METHODS } from "./format";

export type Range = { from: Date; to: Date };

const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function parseRange(params: { from?: string; to?: string }): Range {
  const to = params.to ? new Date(params.to + "T23:59:59") : new Date();
  let from: Date;
  if (params.from) {
    from = new Date(params.from + "T00:00:00");
  } else {
    from = new Date(to);
    from.setDate(from.getDate() - 90);
  }
  return { from, to };
}

export function rangeLabel(r: Range): string {
  const f = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
  return `${f.format(r.from)} — ${f.format(r.to)}`;
}

export function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthBuckets(range: Range) {
  const buckets: { key: string; label: string; value: number }[] = [];
  const cur = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  const end = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
  while (cur <= end && buckets.length < 24) {
    buckets.push({
      key: `${cur.getFullYear()}-${cur.getMonth()}`,
      label: `${MONTHS_PT[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`,
      value: 0,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

export async function getReportData(range: Range) {
  const activeStatus: OrderStatus[] = ["CONFIRMED", "INVOICED"];

  const [orders, leads, transactions] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: activeStatus },
        createdAt: { gte: range.from, lte: range.to },
      },
      include: {
        customer: true,
        seller: true,
        items: { include: { product: true } },
      },
    }),
    prisma.lead.findMany({ where: { deletedAt: null } }),
    prisma.transaction.findMany({ where: { deletedAt: null }, include: { payments: true } }),
  ]);

  // KPIs
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const orderCount = orders.length;
  const avgTicket = orderCount ? revenue / orderCount : 0;
  let margin = 0;
  for (const o of orders)
    for (const it of o.items)
      margin += (it.unitPrice - it.product.cost) * it.quantity;

  // Vendas por mês
  const buckets = monthBuckets(range);
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const o of orders) {
    const k = `${o.createdAt.getFullYear()}-${o.createdAt.getMonth()}`;
    const i = idx.get(k);
    if (i !== undefined) buckets[i].value += o.total;
  }

  // Curva ABC de produtos (por faturamento)
  const prodMap = new Map<number, { name: string; sku: string; qty: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const e = prodMap.get(it.productId) ?? {
        name: it.product.name,
        sku: it.product.sku,
        qty: 0,
        revenue: 0,
      };
      e.qty += it.quantity;
      e.revenue += it.unitPrice * it.quantity;
      prodMap.set(it.productId, e);
    }
  }
  const abcSorted = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue);
  const totalRev = abcSorted.reduce((s, p) => s + p.revenue, 0) || 1;
  let cum = 0;
  const abc = abcSorted.map((p) => {
    cum += p.revenue;
    const cumPct = (cum / totalRev) * 100;
    const cls = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
    return { ...p, share: (p.revenue / totalRev) * 100, cumPct, cls };
  });

  // Top clientes
  const custMap = new Map<number, { name: string; revenue: number; orders: number }>();
  for (const o of orders) {
    const e = custMap.get(o.customerId) ?? { name: o.customer.name, revenue: 0, orders: 0 };
    e.revenue += o.total;
    e.orders += 1;
    custMap.set(o.customerId, e);
  }
  const topCustomers = [...custMap.values()].sort((a, b) => b.revenue - a.revenue);

  // Vendas por vendedor (+ comissão a partir do % de cada funcionário)
  const sellerMap = new Map<
    number,
    { name: string; revenue: number; orders: number; commissionPct: number }
  >();
  for (const o of orders) {
    if (!o.sellerId) continue;
    const e = sellerMap.get(o.sellerId) ?? {
      name: o.seller?.name ?? "—",
      revenue: 0,
      orders: 0,
      commissionPct: o.seller?.commissionPct ?? 0,
    };
    e.revenue += o.total;
    e.orders += 1;
    sellerMap.set(o.sellerId, e);
  }
  const salesBySeller = [...sellerMap.values()].sort((a, b) => b.revenue - a.revenue);

  // Comissões a pagar no período (faturamento × % do vendedor)
  const commissions = salesBySeller
    .map((s) => ({
      name: s.name,
      revenue: s.revenue,
      orders: s.orders,
      commissionPct: s.commissionPct,
      commission: s.revenue * (s.commissionPct / 100),
    }))
    .filter((s) => s.commissionPct > 0)
    .sort((a, b) => b.commission - a.commission);
  const commissionTotal = commissions.reduce((s, c) => s + c.commission, 0);

  // Funil de leads (estado atual, valor por etapa)
  const STAGES = ["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"];
  const funnel = STAGES.map((stage) => {
    const ls = leads.filter((l) => l.stage === stage);
    return {
      stage,
      count: ls.length,
      value: ls.reduce((s, l) => s + l.value, 0),
    };
  });

  // Análise de perdas: motivos dos orçamentos marcados como "Perdido".
  const LOSS_REASONS = ["PRAZO_ENTREGA", "PRECO", "PRODUTO", "OUTRO_FORNECEDOR", "OUTRO"];
  const lostLeads = leads.filter((l) => l.stage === "LOST");
  const lostReasons = LOSS_REASONS.map((reason) => {
    const ls = lostLeads.filter((l) => l.lossReason === reason);
    return { reason, count: ls.length, value: ls.reduce((s, l) => s + l.value, 0) };
  }).filter((r) => r.count > 0);
  const lossSummary = {
    count: lostLeads.length,
    value: lostLeads.reduce((s, l) => s + l.value, 0),
    noReason: lostLeads.filter((l) => !l.lossReason).length,
  };

  // Taxa de conversão (ganhos / fechados).
  const wonCount = leads.filter((l) => l.stage === "WON").length;
  const closed = wonCount + lostLeads.length;
  const winRate = closed > 0 ? (wonCount / closed) * 100 : 0;

  // Financeiro / fluxo de caixa (baseado em pagamentos, suporta parciais)
  const inRange = (d: Date) => d >= range.from && d <= range.to;
  let received = 0;
  let paidOut = 0;
  let receivablePending = 0;
  let payablePending = 0;
  const methodMap = new Map<string, number>();

  for (const t of transactions) {
    for (const p of t.payments) {
      if (!inRange(p.paidAt)) continue;
      if (t.type === "RECEIVABLE") {
        received += p.amount;
        methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + p.amount);
      } else {
        paidOut += p.amount;
      }
    }
    const left = remaining(t);
    if (t.type === "RECEIVABLE") receivablePending += left;
    else payablePending += left;
  }

  const finance = { received, paid: paidOut, receivablePending, payablePending };
  const paymentsByMethod = PAYMENT_METHODS.map((m) => ({
    method: m,
    value: methodMap.get(m) ?? 0,
  })).filter((x) => x.value > 0);

  return {
    range,
    kpis: { revenue, orderCount, avgTicket, margin },
    monthlySales: buckets,
    abc,
    topCustomers,
    salesBySeller,
    commissions,
    commissionTotal,
    funnel,
    lostReasons,
    lossSummary,
    winRate,
    finance,
    paymentsByMethod,
  };
}
