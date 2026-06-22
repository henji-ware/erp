import Link from "next/link";
import {
  formatCurrency,
  LEAD_STAGE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/format";
import { Icon } from "../components/icons";
import {
  getReportData,
  parseRange,
  rangeLabel,
  toInputDate,
} from "@/lib/reports";
import { PageHeader, StatCard, Badge } from "../components/ui";
import { AreaChart, HBarList } from "../components/charts";
import PrintButton from "./PrintButton";

const fmtToday = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const data = await getReportData(range);

  const exportHref = (type: string) =>
    `/api/reports/export?type=${type}&from=${toInputDate(range.from)}&to=${toInputDate(range.to)}`;

  return (
    <div>
      {/* Cabeçalho da marca (aparece apenas no PDF/impressão) */}
      <div className="hidden print:mb-6 print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-300 pb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DRR Projetos e Equipamentos" width={54} height={54} className="object-contain" />
            <div>
              <p className="text-lg font-bold text-slate-900">DRR Projetos e Equipamentos</p>
              <p className="text-xs text-slate-500">
                Relatório Gerencial · período {rangeLabel(range)}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Emitido em</p>
            <p className="font-medium text-slate-700">{fmtToday.format(new Date())}</p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Relatórios"
        subtitle={`Gerados automaticamente · período ${rangeLabel(range)}`}
        action={<PrintButton />}
      />

      {/* Filtro de período */}
      <form
        method="get"
        className="no-print mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="label">De</label>
          <input
            type="date"
            name="from"
            defaultValue={toInputDate(range.from)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={toInputDate(range.to)}
            className="input"
          />
        </div>
        <button className="btn-primary">Aplicar</button>
        <Link href="/reports" className="btn-ghost">
          Últimos 90 dias
        </Link>
        <div className="ml-auto flex gap-2">
          <a href={exportHref("abc")} className="btn-ghost no-print">
            <Icon name="download" size={15} /> CSV Curva ABC
          </a>
          <a href={exportHref("customers")} className="btn-ghost no-print">
            <Icon name="download" size={15} /> CSV Clientes
          </a>
        </div>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatCurrency(data.kpis.revenue)}
          hint="Pedidos confirmados/faturados"
          accent="text-green-600"
        />
        <StatCard label="Pedidos" value={String(data.kpis.orderCount)} />
        <StatCard label="Ticket médio" value={formatCurrency(data.kpis.avgTicket)} />
        <StatCard
          label="Margem estimada"
          value={formatCurrency(data.kpis.margin)}
          hint="Receita − custo dos itens"
          accent="text-brand-600"
        />
      </div>

      {/* Vendas por mês + Funil */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Vendas por mês</h2>
          <AreaChart data={data.monthlySales} formatValue={formatCurrency} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Funil de leads (valor)</h2>
          <HBarList
            data={data.funnel.map((f) => ({
              label: LEAD_STAGE_LABELS[f.stage],
              value: f.value,
              sub: `${f.count} leads`,
            }))}
            formatValue={formatCurrency}
          />
        </div>
      </div>

      {/* Curva ABC */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">
            Curva ABC de produtos
          </h2>
          <span className="text-xs text-slate-400">
            A: 80% · B: 95% · C: restante do faturamento
          </span>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="th">Produto</th>
              <th className="th text-right">Qtd</th>
              <th className="th text-right">Faturamento</th>
              <th className="th text-right">% do total</th>
              <th className="th text-right">% acumulado</th>
              <th className="th text-center">Classe</th>
            </tr>
          </thead>
          <tbody>
            {data.abc.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  Sem vendas no período.
                </td>
              </tr>
            ) : (
              data.abc.map((p) => (
                <tr key={p.sku} className="border-b border-slate-50 last:border-0">
                  <td className="td">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </td>
                  <td className="td text-right">{p.qty}</td>
                  <td className="td text-right font-medium">{formatCurrency(p.revenue)}</td>
                  <td className="td text-right text-slate-500">{p.share.toFixed(1)}%</td>
                  <td className="td text-right text-slate-500">{p.cumPct.toFixed(1)}%</td>
                  <td className="td text-center">
                    <Badge
                      className={
                        p.cls === "A"
                          ? "bg-green-100 text-green-700"
                          : p.cls === "B"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }
                    >
                      {p.cls}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Top clientes + DRE simplificado */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">
            Top clientes por faturamento
          </h2>
          <HBarList
            data={data.topCustomers.slice(0, 8).map((c) => ({
              label: c.name,
              value: c.revenue,
              sub: `${c.orders} pedido(s)`,
            }))}
            formatValue={formatCurrency}
          />
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">
            Demonstrativo financeiro
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Recebido no período" value={data.finance.received} positive />
            <Row label="Pago no período" value={-data.finance.paid} />
            <div className="my-2 border-t border-slate-100" />
            <Row
              label="Resultado de caixa"
              value={data.finance.received - data.finance.paid}
              strong
            />
            <div className="my-2 border-t border-slate-100" />
            <Row label="A receber (pendente)" value={data.finance.receivablePending} positive />
            <Row label="A pagar (pendente)" value={-data.finance.payablePending} />
            <Row
              label="Saldo projetado"
              value={data.finance.receivablePending - data.finance.payablePending}
              strong
            />
          </dl>
        </div>
      </div>

      {/* Vendas por vendedor + Recebimentos por forma de pagamento */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Vendas por vendedor</h2>
          <HBarList
            data={data.salesBySeller.map((s) => ({
              label: s.name,
              value: s.revenue,
              sub: `${s.orders} venda(s)`,
            }))}
            formatValue={formatCurrency}
          />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">
            Recebimentos por forma de pagamento
          </h2>
          <HBarList
            data={data.paymentsByMethod.map((m) => ({
              label: PAYMENT_METHOD_LABELS[m.method],
              value: m.value,
            }))}
            formatValue={formatCurrency}
          />
        </div>
      </div>

      <p className="no-print mt-6 text-center text-xs text-slate-400">
        Dica: use “Imprimir / PDF” para salvar este relatório como PDF.
      </p>

      {/* Rodapé fixo do PDF (repete em todas as páginas, somente impressão) */}
      <div className="report-footer">
        <span>DRR Projetos e Equipamentos</span>
        <span>Projetos · Equipamentos · Inspeções · Manutenção</span>
        <span>contato@drrprojetos.com.br · +55 (11) 3000-4567</span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
  strong,
}: {
  label: string;
  value: number;
  positive?: boolean;
  strong?: boolean;
}) {
  const color = value > 0 ? (positive ? "text-green-600" : "text-slate-800") : value < 0 ? "text-red-600" : "text-slate-500";
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold text-slate-800" : "text-slate-600"}>
        {label}
      </dt>
      <dd className={`${strong ? "font-bold" : "font-medium"} ${color}`}>
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
