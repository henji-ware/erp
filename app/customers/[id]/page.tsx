import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  formatDate,
  ORDER_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  LEAD_STAGE_LABELS,
  INSPECTION_STATUS_LABELS,
  TX_TYPE_LABELS,
  TX_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from "@/lib/format";
import { PageHeader } from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";
import SubmitButton from "../../components/SubmitButton";
import { updateCustomer } from "../actions";

export const dynamic = "force-dynamic";

type TimelineEvent = {
  date: Date;
  icon: IconName;
  color: string;
  title: string;
  sub: string;
  href?: string;
};

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
    include: {
      orders: true,
      projects: true,
      inspections: true,
      leads: true,
      transactions: true,
      appointments: true,
      rentals: { include: { product: true } },
      maintenanceContracts: true,
    },
  });
  if (!customer) notFound();

  // Monta a linha do tempo unificada (todos os vínculos, mais recente primeiro).
  const events: TimelineEvent[] = [
    ...customer.orders.map((o) => ({
      date: o.createdAt,
      icon: "orders" as IconName,
      color: "text-green-600",
      title: `Pedido ${o.number} · ${formatCurrency(o.total)}`,
      sub: ORDER_STATUS_LABELS[o.status],
      href: "/orders",
    })),
    ...customer.projects.map((p) => ({
      date: p.createdAt,
      icon: "projects" as IconName,
      color: "text-brand-600",
      title: `Projeto ${p.title} · ${formatCurrency(p.value)}`,
      sub: PROJECT_STATUS_LABELS[p.status],
      href: `/projects/${p.id}`,
    })),
    ...customer.inspections.map((i) => ({
      date: i.scheduledAt,
      icon: "inspection" as IconName,
      color: "text-blue-600",
      title: `Inspeção${i.artNumber ? ` · ART ${i.artNumber}` : ""}`,
      sub: INSPECTION_STATUS_LABELS[i.status],
      href: `/inspections/${i.id}`,
    })),
    ...customer.leads.map((l) => ({
      date: l.createdAt,
      icon: "leads" as IconName,
      color: "text-amber-600",
      title: `Orçamento ${l.name} · ${formatCurrency(l.value)}`,
      sub: LEAD_STAGE_LABELS[l.stage],
      href: `/leads/${l.id}`,
    })),
    ...customer.transactions.map((t) => ({
      date: t.createdAt,
      icon: "finance" as IconName,
      color: t.type === "RECEIVABLE" ? "text-green-600" : "text-red-600",
      title: `${TX_TYPE_LABELS[t.type]}: ${t.description} · ${formatCurrency(t.amount)}`,
      sub: `${TX_STATUS_LABELS[t.status]} · venc. ${formatDate(t.dueDate)}`,
      href: `/finance/${t.id}`,
    })),
    ...customer.rentals.map((r) => ({
      date: r.createdAt,
      icon: "rental" as IconName,
      color: "text-blue-600",
      title: `Locação ${r.product.name} · ${formatCurrency(r.monthlyRate * r.quantity)}/mês`,
      sub: RENTAL_STATUS_LABELS[r.status],
      href: "/rentals",
    })),
    ...customer.maintenanceContracts.map((m) => ({
      date: m.createdAt,
      icon: "maintenance" as IconName,
      color: "text-slate-600",
      title: `Manutenção: ${m.title}`,
      sub: m.nextVisit ? `Próxima visita ${formatDate(m.nextVisit)}` : "Sem próxima visita",
      href: "/maintenance",
    })),
    ...customer.appointments.map((a) => ({
      date: a.startsAt,
      icon: "calendar" as IconName,
      color: "text-slate-600",
      title: a.title,
      sub: APPOINTMENT_TYPE_LABELS[a.type],
      href: `/appointments/${a.id}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="max-w-5xl">
      <PageHeader title={customer.name} subtitle="Ficha do cliente · histórico completo" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Dados do cliente */}
        <div className="card h-fit p-6 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Dados</h2>
          <form action={updateCustomer} className="space-y-3">
            <input type="hidden" name="id" value={customer.id} />
            <div>
              <label className="label">Nome *</label>
              <input name="name" required defaultValue={customer.name} className="input" />
            </div>
            <div>
              <label className="label">Empresa</label>
              <input name="company" defaultValue={customer.company ?? ""} className="input" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" defaultValue={customer.email ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input name="phone" defaultValue={customer.phone ?? ""} className="input" />
            </div>
            <div>
              <label className="label">CPF / CNPJ</label>
              <input name="document" defaultValue={customer.document ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className="input" />
            </div>
            <div className="flex gap-2 pt-2">
              <SubmitButton>Salvar alterações</SubmitButton>
              <Link href="/customers" className="btn-ghost">Voltar</Link>
            </div>
          </form>
        </div>

        {/* Linha do tempo */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">
            Histórico <span className="text-slate-400">({events.length})</span>
          </h2>
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhuma movimentação registrada para este cliente.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-6">
              {events.map((e, i) => {
                const inner = (
                  <>
                    <span className="absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                      <Icon name={e.icon} size={13} className={e.color} />
                    </span>
                    <p className="text-sm font-medium text-slate-800">{e.title}</p>
                    <p className="text-xs text-slate-400">
                      {e.sub} · {formatDate(e.date)}
                    </p>
                  </>
                );
                return (
                  <li key={i} className="relative">
                    {e.href ? (
                      <Link href={e.href} className="block rounded-lg p-1 transition-colors hover:bg-slate-50">
                        {inner}
                      </Link>
                    ) : (
                      <div className="p-1">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
