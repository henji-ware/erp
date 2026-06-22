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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.findMany(),
    prisma.lead.findMany({ where: { stage: { notIn: ["WON", "LOST"] } } }),
    prisma.order.findMany({ where: { status: { not: "CANCELLED" } } }),
    prisma.transaction.findMany({ where: { type: "RECEIVABLE", status: { not: "PAID" } }, include: { payments: true } }),
    prisma.transaction.findMany({ where: { type: "PAYABLE", status: { not: "PAID" } }, include: { payments: true } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.lead.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.appointment.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: new Date() } },
      take: 5,
      orderBy: { startsAt: "asc" },
      include: { customer: true, employee: true },
    }),
    prisma.project.findMany({ where: { status: { notIn: ["CONCLUIDO", "CANCELADO"] } } }),
    prisma.inspection.count({ where: { status: "AGENDADA" } }),
  ]);

  const inventoryValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.stock <= 5).length;
  const pipeline = openLeads.reduce((s, l) => s + l.value, 0);
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const totalReceivable = receivables.reduce((s, t) => s + remaining(t), 0);
  const totalPayable = payables.reduce((s, t) => s + remaining(t), 0);
  const balance = totalReceivable - totalPayable;
  const projectBacklog = openProjects.reduce((s, p) => s + p.value, 0);
  const runningProjects = openProjects.filter((p) => p.status === "EM_EXECUCAO").length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral — projetos, inspeções, vendas, equipamentos e financeiro"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clientes" value={String(customerCount)} hint="CRM" delay={0} />
        <StatCard
          label="Funil aberto"
          value={formatCurrency(pipeline)}
          hint={`${openLeads.length} leads em aberto`}
          accent="text-brand-600"
          delay={60}
        />
        <StatCard
          label="Receita (pedidos)"
          value={formatCurrency(revenue)}
          hint={`${orders.length} pedidos ativos`}
          accent="text-green-600"
          delay={120}
        />
        <StatCard
          label="Estoque"
          value={formatCurrency(inventoryValue)}
          hint={`${products.length} produtos · ${lowStock} com estoque baixo`}
          delay={180}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="A receber (pendente)"
          value={formatCurrency(totalReceivable)}
          accent="text-green-600"
        />
        <StatCard
          label="A pagar (pendente)"
          value={formatCurrency(totalPayable)}
          accent="text-red-600"
        />
        <StatCard
          label="Saldo projetado"
          value={formatCurrency(balance)}
          accent={balance >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Projetos em carteira"
          value={formatCurrency(projectBacklog)}
          hint={`${openProjects.length} ativos`}
          accent="text-brand-600"
        />
        <StatCard label="Projetos em execução" value={String(runningProjects)} accent="text-amber-600" />
        <StatCard label="Inspeções agendadas" value={String(scheduledInspections)} accent="text-blue-600" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pedidos recentes */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Pedidos recentes</h2>
            <Link href="/orders" className="text-sm text-brand-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nenhum pedido ainda.
            </p>
          ) : (
            <table className="w-full">
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0">
                    <td className="td font-medium">{o.number}</td>
                    <td className="td text-slate-500">{o.customer.name}</td>
                    <td className="td">
                      <Badge className={ORDER_STATUS_COLORS[o.status]}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </td>
                    <td className="td text-right font-medium">
                      {formatCurrency(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Leads recentes */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Leads recentes</h2>
            <Link href="/leads" className="text-sm text-brand-600 hover:underline">
              Ver funil
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nenhum lead ainda.
            </p>
          ) : (
            <table className="w-full">
              <tbody>
                {recentLeads.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0">
                    <td className="td font-medium">{l.name}</td>
                    <td className="td">
                      <Badge className={LEAD_STAGE_COLORS[l.stage]}>
                        {LEAD_STAGE_LABELS[l.stage]}
                      </Badge>
                    </td>
                    <td className="td text-right text-slate-500">
                      {formatDate(l.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Próximos agendamentos */}
      <div className="mt-6 card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Próximos agendamentos</h2>
          <Link href="/appointments" className="text-sm text-brand-600 hover:underline">
            Ver agenda
          </Link>
        </div>
        {upcomingAppointments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Nenhum agendamento futuro.
          </p>
        ) : (
          <table className="w-full">
            <tbody>
              {upcomingAppointments.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0">
                  <td className="td font-medium">{a.title}</td>
                  <td className="td text-slate-500">
                    {APPOINTMENT_TYPE_LABELS[a.type]}
                    {a.customer ? ` · ${a.customer.name}` : ""}
                  </td>
                  <td className="td text-right text-slate-500">
                    {formatDateTime(a.startsAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
