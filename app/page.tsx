import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remaining } from "@/lib/finance";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import { lastMonths, monthKey } from "@/lib/reports";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/format";
import { PageHeader, StatCard, Badge, pctChange } from "./components/ui";
import { AreaChart, GroupedBars, Sparkline } from "./components/charts";
import { Icon, type IconName } from "./components/icons";
import { getCurrentUser, crmScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  // Janela das séries dos KPIs: os 6 últimos meses, contados do dia 1º do
  // mês mais antigo (não de "180 dias atrás", senão o primeiro mês entraria
  // pela metade e apareceria como uma queda que não existe).
  const months = lastMonths(6, now);
  const since = months[0].start;
  const user = await getCurrentUser();
  const scope = crmScope(user); // {} p/ admin; { OR: próprios + compartilhados }

  const [
    customerCount,
    products,
    openLeads,
    orders,
    receivables,
    payables,
    recentOrders,
    recentLeads,
    upcomingAppointments,
    openProjects,
    scheduledInspections,
    upcomingInspections,
    overdueRentals,
    activeRentals,
    maintenanceDue,
    customerHistory,
    leadHistory,
    paymentHistory,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null, ...scope } }),
    prisma.product.findMany({ where: { deletedAt: null } }),
    prisma.lead.findMany({ where: { deletedAt: null, ...scope, stage: { notIn: ["WON", "LOST"] } } }),
    prisma.order.findMany({ where: { deletedAt: null, status: { not: "CANCELLED" }, ...scope } }),
    prisma.transaction.findMany({ where: { deletedAt: null, type: "RECEIVABLE", status: { not: "PAID" }, ...scope }, include: { payments: true } }),
    prisma.transaction.findMany({ where: { deletedAt: null, type: "PAYABLE", status: { not: "PAID" }, ...scope }, include: { payments: true } }),
    prisma.order.findMany({ where: { deletedAt: null, ...scope }, take: 5, orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.lead.findMany({ where: { deletedAt: null, ...scope }, take: 5, orderBy: { createdAt: "desc" } }),
    prisma.appointment.findMany({
      where: { deletedAt: null, status: "SCHEDULED", startsAt: { gte: now }, ...scope },
      take: 5,
      orderBy: { startsAt: "asc" },
      include: { customer: true, employee: true },
    }),
    prisma.project.findMany({ where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] }, ...scope } }),
    prisma.inspection.count({ where: { deletedAt: null, status: "AGENDADA", ...scope } }),
    prisma.inspection.findMany({
      where: { deletedAt: null, status: "AGENDADA", scheduledAt: { gte: now, lte: in7 }, ...scope },
      orderBy: { scheduledAt: "asc" },
      include: { customer: true },
    }),
    prisma.rental.findMany({
      where: { deletedAt: null, status: "ACTIVE", expectedEnd: { lt: now }, ...scope },
      include: { customer: true, product: true },
    }),
    prisma.rental.findMany({ where: { deletedAt: null, status: "ACTIVE", ...scope } }),
    prisma.maintenanceContract.findMany({
      where: { deletedAt: null, status: "ACTIVE", nextVisit: { lte: in7 }, ...scope },
      orderBy: { nextVisit: "asc" },
      include: { customer: true },
    }),
    // --- séries históricas (só os campos usados nos gráficos) ---
    prisma.customer.findMany({
      where: { deletedAt: null, ...scope, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ...scope, createdAt: { gte: since } },
      select: { createdAt: true, value: true },
    }),
    // Caixa realizado: vem dos pagamentos, não das contas em aberto — só
    // assim entra o que já foi quitado (inclusive parcial).
    prisma.payment.findMany({
      where: {
        paidAt: { gte: since },
        transaction: { deletedAt: null, ...scope },
      },
      select: { amount: true, paidAt: true, transaction: { select: { type: true } } },
    }),
  ]);

  const inventoryValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.kind === "PRODUCT" && p.stock <= 5);
  const pipeline = openLeads.reduce((s, l) => s + l.value, 0);
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const totalReceivable = receivables.reduce((s, t) => s + remaining(t), 0);
  const totalPayable = payables.reduce((s, t) => s + remaining(t), 0);
  const balance = totalReceivable - totalPayable;
  const projectBacklog = openProjects.reduce((s, p) => s + p.value, 0);
  const runningProjects = openProjects.filter((p) => p.status === "EM_EXECUCAO").length;
  const rentalRevenue = activeRentals.reduce((s, r) => s + r.monthlyRate * r.quantity, 0);

  // ---- Séries mensais dos KPIs ----
  // Um índice por chave de mês; tudo o que cai fora da janela é ignorado.
  const slot = new Map(months.map((m, i) => [m.key, i]));
  const emptySeries = () => months.map(() => 0);

  const sumInto = <T,>(items: T[], date: (x: T) => Date, amount: (x: T) => number) => {
    const series = emptySeries();
    for (const item of items) {
      const i = slot.get(monthKey(date(item)));
      if (i !== undefined) series[i] += amount(item);
    }
    return series;
  };

  const revenueSeries = sumInto(orders, (o) => o.createdAt, (o) => o.total);
  const customerSeries = sumInto(customerHistory, (c) => c.createdAt, () => 1);
  const leadSeries = sumInto(leadHistory, (l) => l.createdAt, (l) => l.value);
  const cashInSeries = sumInto(
    paymentHistory.filter((p) => p.transaction.type === "RECEIVABLE"),
    (p) => p.paidAt,
    (p) => p.amount,
  );
  const cashOutSeries = sumInto(
    paymentHistory.filter((p) => p.transaction.type === "PAYABLE"),
    (p) => p.paidAt,
    (p) => p.amount,
  );

  // Variação do mês corrente contra o anterior (últimos dois baldes).
  const last = months.length - 1;
  const deltaOf = (series: number[]) => pctChange(series[last], series[last - 1]);
  const TREND_LABEL = "vs. mês anterior";

  const monthlySales = months.map((m, i) => ({ label: m.label, value: revenueSeries[i] }));
  const cashFlow = months.map((m, i) => ({
    label: m.label,
    a: cashInSeries[i],
    b: cashOutSeries[i],
  }));
  const cashInTotal = cashInSeries.reduce((s, v) => s + v, 0);
  const cashOutTotal = cashOutSeries.reduce((s, v) => s + v, 0);

  // Contas vencidas (a receber + a pagar, ainda em aberto).
  const overdueBills = [...receivables, ...payables].filter((t) => t.dueDate < now);
  const overdueValue = overdueBills.reduce((s, t) => s + remaining(t), 0);

  // Painel de pendências (somente o que exige ação).
  const alerts: { icon: IconName; color: string; label: string; value: string; href: string }[] = [];
  if (overdueBills.length > 0)
    alerts.push({ icon: "finance", color: "text-red-600", label: "Contas vencidas", value: `${overdueBills.length} · ${formatCurrency(overdueValue)}`, href: "/finance" });
  if (upcomingInspections.length > 0)
    alerts.push({ icon: "inspection", color: "text-blue-600", label: "Inspeções em ≤7 dias", value: String(upcomingInspections.length), href: "/inspections" });
  if (maintenanceDue.length > 0)
    alerts.push({ icon: "maintenance", color: "text-amber-600", label: "Manutenções a vencer", value: String(maintenanceDue.length), href: "/maintenance" });
  if (overdueRentals.length > 0)
    alerts.push({ icon: "rental", color: "text-red-600", label: "Locações atrasadas", value: String(overdueRentals.length), href: "/rentals" });
  if (lowStock.length > 0)
    alerts.push({ icon: "products", color: "text-amber-600", label: "Estoque baixo", value: String(lowStock.length), href: "/products" });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral — projetos, inspeções, vendas, locações e financeiro"
      />

      {/* Painel de pendências */}
      {alerts.length > 0 && (
        <div className="alert-surface alert-warn mb-6 rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="alert-icon"><Icon name="alert" size={14} /></span>
            <h2 className="alert-title text-sm">Precisa de atenção</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {alerts.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="card hover-lift flex items-center gap-3 p-3"
              >
                <span className={a.color}><Icon name={a.icon} size={20} /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-500">{a.label}</p>
                  <p className="text-sm font-bold text-slate-800">{a.value}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clientes"
          value={String(customerCount)}
          hint={`${customerSeries[last]} novos neste mês`}
          delay={0}
          icon={<Icon name="customers" size={18} />}
          trend={{ pct: deltaOf(customerSeries), label: `Novos cadastros ${TREND_LABEL}` }}
          spark={<Sparkline id="clientes" data={customerSeries} />}
          sparkClassName="text-slate-400"
        />
        <StatCard
          label="Funil aberto"
          value={formatCurrency(pipeline)}
          hint={`${openLeads.length} leads em aberto`}
          accent="text-brand-600"
          delay={60}
          icon={<Icon name="leads" size={18} />}
          trend={{ pct: deltaOf(leadSeries), label: `Orçamentos criados ${TREND_LABEL}` }}
          spark={<Sparkline id="funil" data={leadSeries} />}
          sparkClassName="text-brand-500"
        />
        <StatCard
          label="Receita (pedidos)"
          value={formatCurrency(revenue)}
          hint={`${orders.length} pedidos ativos`}
          accent="text-green-600"
          delay={120}
          icon={<Icon name="orders" size={18} />}
          trend={{ pct: deltaOf(revenueSeries), label: `Pedidos do mês ${TREND_LABEL}` }}
          spark={<Sparkline id="receita" data={revenueSeries} />}
          sparkClassName="text-green-600"
        />
        <StatCard
          label="Locação (mensal)"
          value={formatCurrency(rentalRevenue)}
          hint={`${activeRentals.length} em locação`}
          accent="text-blue-600"
          delay={180}
          icon={<Icon name="rental" size={18} />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="A receber (pendente)"
          value={formatCurrency(totalReceivable)}
          accent="text-green-600"
          hint={`${receivables.length} lançamentos em aberto`}
          icon={<Icon name="finance" size={18} />}
        />
        <StatCard
          label="A pagar (pendente)"
          value={formatCurrency(totalPayable)}
          accent="text-red-600"
          hint={`${payables.length} lançamentos em aberto`}
          icon={<Icon name="card" size={18} />}
        />
        <StatCard
          label="Saldo projetado"
          value={formatCurrency(balance)}
          accent={balance >= 0 ? "text-green-600" : "text-red-600"}
          hint="A receber − a pagar"
          icon={<Icon name="reports" size={18} />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projetos em carteira"
          value={formatCurrency(projectBacklog)}
          hint={`${openProjects.length} ativos`}
          accent="text-brand-600"
          icon={<Icon name="projects" size={18} />}
        />
        <StatCard
          label="Projetos em execução"
          value={String(runningProjects)}
          accent="text-amber-600"
          icon={<Icon name="briefcase" size={18} />}
        />
        <StatCard
          label="Inspeções agendadas"
          value={String(scheduledInspections)}
          accent="text-blue-600"
          icon={<Icon name="inspection" size={18} />}
        />
        <StatCard
          label="Estoque (valor)"
          value={formatCurrency(inventoryValue)}
          hint={`${products.length} itens · ${lowStock.length} baixo`}
          icon={<Icon name="products" size={18} />}
        />
      </div>

      {/* Gráficos — a leitura que os números sozinhos não dão */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-800">Receita por mês</h2>
            <span className="text-xs text-slate-400">últimos 6 meses</span>
          </div>
          <AreaChart data={monthlySales} formatValue={formatCurrencyCompact} />
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-800">Caixa realizado</h2>
            <span className="text-xs text-slate-400">
              {formatCurrencyCompact(cashInTotal - cashOutTotal)} no período
            </span>
          </div>
          {/* Realizado = o que foi pago de fato (inclui quitação parcial),
              diferente de "a receber/a pagar", que é previsão. */}
          <GroupedBars
            data={cashFlow}
            labelA="Entradas"
            labelB="Saídas"
            formatValue={formatCurrency}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pedidos recentes */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Pedidos recentes</h2>
            <Link href="/orders" className="text-sm text-brand-600 hover:underline">Ver todos</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum pedido ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-50 last:border-0">
                      <td className="td font-medium">{o.number}</td>
                      <td className="td text-slate-500">{o.customer.name}</td>
                      <td className="td">
                        <Badge className={ORDER_STATUS_COLORS[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                      </td>
                      <td className="td text-right font-medium">{formatCurrency(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inspeções próximas */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Inspeções próximas (7 dias)</h2>
            <Link href="/inspections" className="text-sm text-brand-600 hover:underline">Ver todas</Link>
          </div>
          {upcomingInspections.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhuma inspeção nos próximos 7 dias.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {upcomingInspections.map((i) => (
                    <tr key={i.id} className="border-b border-slate-50 last:border-0">
                      <td className="td font-medium">{i.customer.name}</td>
                      <td className="td text-slate-500">{i.location ?? i.engineer ?? "—"}</td>
                      <td className="td text-right text-slate-500">{formatDateTime(i.scheduledAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Leads recentes */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Leads recentes</h2>
            <Link href="/leads" className="text-sm text-brand-600 hover:underline">Ver funil</Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum lead ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {recentLeads.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 last:border-0">
                      <td className="td font-medium">{l.name}</td>
                      <td className="td">
                        <Badge className={LEAD_STAGE_COLORS[l.stage]}>{LEAD_STAGE_LABELS[l.stage]}</Badge>
                      </td>
                      <td className="td text-right text-slate-500">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Próximos agendamentos */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Próximos agendamentos</h2>
            <Link href="/appointments" className="text-sm text-brand-600 hover:underline">Ver agenda</Link>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum agendamento futuro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {upcomingAppointments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0">
                      <td className="td font-medium">{a.title}</td>
                      <td className="td text-slate-500">
                        {APPOINTMENT_TYPE_LABELS[a.type]}
                        {a.customer ? ` · ${a.customer.name}` : ""}
                      </td>
                      <td className="td text-right text-slate-500">{formatDateTime(a.startsAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
