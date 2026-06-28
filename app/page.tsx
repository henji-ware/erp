import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remaining } from "@/lib/finance";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/format";
import { PageHeader, StatCard, Badge } from "./components/ui";
import { Icon, type IconName } from "./components/icons";
import { getCurrentUser, ownerScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const user = await getCurrentUser();
  const leadScope = ownerScope(user);

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
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.product.findMany({ where: { deletedAt: null } }),
    prisma.lead.findMany({ where: { deletedAt: null, ...leadScope, stage: { notIn: ["WON", "LOST"] } } }),
    prisma.order.findMany({ where: { status: { not: "CANCELLED" } } }),
    prisma.transaction.findMany({ where: { type: "RECEIVABLE", status: { not: "PAID" } }, include: { payments: true } }),
    prisma.transaction.findMany({ where: { type: "PAYABLE", status: { not: "PAID" } }, include: { payments: true } }),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.lead.findMany({ where: { deletedAt: null, ...leadScope }, take: 5, orderBy: { createdAt: "desc" } }),
    prisma.appointment.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: now } },
      take: 5,
      orderBy: { startsAt: "asc" },
      include: { customer: true, employee: true },
    }),
    prisma.project.findMany({ where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } } }),
    prisma.inspection.count({ where: { status: "AGENDADA" } }),
    prisma.inspection.findMany({
      where: { status: "AGENDADA", scheduledAt: { gte: now, lte: in7 } },
      orderBy: { scheduledAt: "asc" },
      include: { customer: true },
    }),
    prisma.rental.findMany({
      where: { status: "ACTIVE", expectedEnd: { lt: now } },
      include: { customer: true, product: true },
    }),
    prisma.rental.findMany({ where: { status: "ACTIVE" } }),
    prisma.maintenanceContract.findMany({
      where: { status: "ACTIVE", nextVisit: { lte: in7 } },
      orderBy: { nextVisit: "asc" },
      include: { customer: true },
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
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-amber-600"><Icon name="reports" size={16} /></span>
            <h2 className="text-sm font-semibold text-amber-800">Precisa de atenção</h2>
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
        <StatCard label="Clientes" value={String(customerCount)} hint="CRM" delay={0} />
        <StatCard label="Funil aberto" value={formatCurrency(pipeline)} hint={`${openLeads.length} leads em aberto`} accent="text-brand-600" delay={60} />
        <StatCard label="Receita (pedidos)" value={formatCurrency(revenue)} hint={`${orders.length} pedidos ativos`} accent="text-green-600" delay={120} />
        <StatCard label="Locação (mensal)" value={formatCurrency(rentalRevenue)} hint={`${activeRentals.length} em locação`} accent="text-blue-600" delay={180} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="A receber (pendente)" value={formatCurrency(totalReceivable)} accent="text-green-600" />
        <StatCard label="A pagar (pendente)" value={formatCurrency(totalPayable)} accent="text-red-600" />
        <StatCard label="Saldo projetado" value={formatCurrency(balance)} accent={balance >= 0 ? "text-green-600" : "text-red-600"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projetos em carteira" value={formatCurrency(projectBacklog)} hint={`${openProjects.length} ativos`} accent="text-brand-600" />
        <StatCard label="Projetos em execução" value={String(runningProjects)} accent="text-amber-600" />
        <StatCard label="Inspeções agendadas" value={String(scheduledInspections)} accent="text-blue-600" />
        <StatCard label="Estoque (valor)" value={formatCurrency(inventoryValue)} hint={`${products.length} itens · ${lowStock.length} baixo`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
