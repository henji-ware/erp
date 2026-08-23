import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatCurrency,
  LEAD_STAGE_LABELS,
  LEAD_LOSS_REASON_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/format";
import { getCurrentUser, isAdmin } from "@/lib/auth";
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
  if (!isAdmin(await getCurrentUser())) notFound();
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

      {/* Análise de perdas (orçamentos perdidos por motivo) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Análise de perdas</h2>
            <Badge
              className={
                data.winRate >= 50
                  ? "badge-tone badge-success"
                  : "badge-tone badge-warn"
              }
            >
              {data.winRate.toFixed(0)}% de conversão
            </Badge>
          </div>
          {data.lostReasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nenhum orçamento perdido com motivo registrado.
            </p>
          ) : (
            <HBarList
              data={data.lostReasons.map((r) => ({
                label: LEAD_LOSS_REASON_LABELS[r.reason],
                value: r.value,
                sub: `${r.count} orçamento(s)`,
              }))}
              formatValue={formatCurrency}
            />
          )}
          <p className="mt-3 text-xs text-slate-400">
            Total perdido: <strong className="text-red-600">{formatCurrency(data.lossSummary.value)}</strong>{" "}
            em {data.lossSummary.count} orçamento(s)
            {data.lossSummary.noReason > 0 && ` · ${data.lossSummary.noReason} sem motivo informado`}
          </p>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Comissões por vendedor</h2>
          {data.commissions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nenhuma comissão no período.
            </p>
          ) : (
            <HBarList
              data={data.commissions.map((c) => ({
                label: c.name,
                value: c.commission,
                sub: `${c.commissionPct}% · ${formatCurrency(c.revenue)}`,
              }))}
              formatValue={formatCurrency}
            />
          )}
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
                          ? "badge-tone badge-success"
                          : p.cls === "B"
                            ? "badge-tone badge-warn"
                            : "badge-tone badge-neutral"
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

      {/* Comissões a pagar no período */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Comissões a pagar</h2>
          <span className="text-xs text-slate-400">
            Faturamento confirmado × % de cada vendedor · período {rangeLabel(range)}
          </span>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="th">Vendedor</th>
              <th className="th text-right">Vendas</th>
              <th className="th text-right">Faturamento</th>
              <th className="th text-right">% comissão</th>
              <th className="th text-right">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {data.commissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  Nenhum vendedor com comissão no período. Defina o % de comissão em RH / Equipe.
                </td>
              </tr>
            ) : (
              <>
                {data.commissions.map((c) => (
                  <tr key={c.name} className="border-b border-slate-50 last:border-0">
                    <td className="td font-medium text-slate-800">{c.name}</td>
                    <td className="td text-right">{c.orders}</td>
                    <td className="td text-right">{formatCurrency(c.revenue)}</td>
                    <td className="td text-right text-slate-500">{c.commissionPct}%</td>
                    <td className="td text-right font-semibold text-brand-600">
                      {formatCurrency(c.commission)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="td font-semibold text-slate-800" colSpan={4}>
                    Total de comissões
                  </td>
                  <td className="td text-right font-bold text-brand-700">
                    {formatCurrency(data.commissionTotal)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="no-print mt-6 text-center text-xs text-slate-400">
        Dica: use “Imprimir / PDF” para salvar este relatório como PDF.
      </p>

      {/* Rodapé fixo do PDF (repete em todas as páginas, somente impressão) */}
      <div className="report-footer">
        <span>DRR Projetos e Equipamentos</span>
        <span>Projetos · Equipamentos · Inspeções · Manutenção</span>
        <span>contato@drrprojetos.com.br</span>
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
