import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  formatDate,
  MAINTENANCE_FREQUENCIES,
  MAINTENANCE_FREQUENCY_LABELS,
} from "@/lib/format";
import { dueInfo } from "@/lib/finance";
import { PageHeader, EmptyState, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { ShareToggle } from "../components/ShareToggle";
import { OwnerTag } from "../components/OwnerTag";
import { parsePage, paginate } from "@/lib/pagination";
import { getCurrentUser, isAdmin, crmScope, ownerNames } from "@/lib/auth";
import SubmitButton from "../components/SubmitButton";
import MaintenanceStatusSelect from "./MaintenanceStatusSelect";
import { createMaintenance, completeVisit, deleteMaintenance } from "./actions";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const user = await getCurrentUser();
  const scope = crmScope(user);
  const owners = await ownerNames();
  const where = {
    deletedAt: null,
    ...(q
      ? {
          AND: [
            scope,
            {
              OR: [
                { title: { contains: q } },
                { refCode: { contains: q } },
                { customer: { name: { contains: q } } },
              ],
            },
          ],
        }
      : scope),
  };

  // KPIs sobre contratos ativos visíveis ao usuário.
  const activeContracts = await prisma.maintenanceContract.findMany({
    where: { deletedAt: null, status: "ACTIVE", ...scope },
  });
  const recurringValue = activeContracts.reduce((s, c) => s + c.value, 0);
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const dueSoon = activeContracts.filter((c) => c.nextVisit && c.nextVisit <= in7).length;

  const total = await prisma.maintenanceContract.count({ where });
  const pg = paginate(total, parsePage(pageParam));

  const [contracts, customers, budgets] = await Promise.all([
    prisma.maintenanceContract.findMany({
      where,
      orderBy: [{ status: "asc" }, { nextVisit: "asc" }],
      skip: pg.skip,
      take: pg.take,
      include: { customer: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...scope }, orderBy: { name: "asc" } }),
    prisma.lead.findMany({
      where: { deletedAt: null, number: { not: null }, ...scope },
      orderBy: { createdAt: "desc" },
      select: { number: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Contratos de manutenção"
        subtitle="Manutenção preventiva recorrente — frequência, valor e próxima visita"
        action={<SearchBar placeholder="Buscar por título, cliente..." defaultValue={q} />}
      />

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Contratos ativos" value={String(activeContracts.length)} accent="text-green-600" delay={0} />
        <StatCard label="Valor por ciclo" value={formatCurrency(recurringValue)} hint="Soma das visitas ativas" accent="text-brand-600" delay={60} />
        <StatCard label="Visitas em ≤7 dias" value={String(dueSoon)} accent={dueSoon > 0 ? "text-amber-600" : "text-slate-400"} delay={120} />
        <StatCard label="Total" value={String(total)} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulário */}
        <div className="card h-fit p-5 xl:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo contrato</h2>
          <form action={createMaintenance} className="space-y-3">
            <div>
              <label className="label">Título *</label>
              <input name="title" required className="input" placeholder="Manutenção preventiva — CD" />
            </div>
            <div>
              <label className="label">Cliente *</label>
              <select name="customerId" required className="input" defaultValue="">
                <option value="" disabled>Selecione...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Frequência</label>
                <select name="frequency" className="input" defaultValue="MONTHLY">
                  {MAINTENANCE_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{MAINTENANCE_FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Valor/visita (R$)</label>
                <input name="value" type="number" step="0.01" min="0" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Próxima visita</label>
              <input name="nextVisit" type="date" className="input" />
            </div>
            <div>
              <label className="label">Orçamento de origem (código)</label>
              <select name="refCode" className="input" defaultValue="">
                <option value="">—</option>
                {budgets.map((b) => (
                  <option key={b.number} value={b.number!}>
                    {b.number} · {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <SubmitButton>Criar contrato</SubmitButton>
          </form>
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">Contrato</th>
                  <th className="th">Próxima visita</th>
                  <th className="th text-right">Valor</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState>Nenhum contrato de manutenção.</EmptyState>
                    </td>
                  </tr>
                ) : (
                  contracts.map((c) => {
                    const due = c.nextVisit ? dueInfo(c.nextVisit, "PENDING") : null;
                    return (
                      <tr key={c.id} className="border-b border-slate-50 align-top last:border-0">
                        <td className="td">
                          <p className="font-medium text-slate-800">
                            {c.title}
                            {c.ownerId && <OwnerTag name={owners.get(c.ownerId)} />}
                          </p>
                          <p className="text-xs text-slate-400">
                            {c.customer.name} · {MAINTENANCE_FREQUENCY_LABELS[c.frequency]}
                            {c.refCode ? ` · Orç. ${c.refCode}` : ""}
                          </p>
                        </td>
                        <td className="td text-slate-600">
                          {c.nextVisit ? formatDate(c.nextVisit) : "—"}
                          {due && <span className={`block text-xs ${due.cls}`}>{due.text}</span>}
                        </td>
                        <td className="td text-right font-medium">{formatCurrency(c.value)}</td>
                        <td className="td">
                          <MaintenanceStatusSelect id={c.id} status={c.status} />
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-1">
                            <ShareToggle entity="maintenanceContract" id={c.id} shared={c.shared} canToggle={isAdmin(user) || c.ownerId === user?.id} />
                            <form action={completeVisit}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="btn-ghost px-2 py-1 text-xs" title="Registrar visita e reagendar próxima">
                                <Icon name="check" size={14} />
                              </button>
                            </form>
                            <form action={deleteMaintenance}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="btn-danger px-2 py-1 text-xs" title="Excluir">
                                <Icon name="trash" size={14} />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            basePath="/maintenance"
            page={pg.page}
            totalPages={pg.totalPages}
            from={pg.from}
            to={pg.to}
            total={pg.total}
            params={{ q }}
          />
        </div>
      </div>
    </div>
  );
}
