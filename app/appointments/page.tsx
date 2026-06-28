import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatDateTime,
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
} from "@/lib/format";
import { PageHeader, EmptyState, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { ShareToggle } from "../components/ShareToggle";
import { OwnerTag } from "../components/OwnerTag";
import { getCurrentUser, isAdmin, crmScope, ownerNames } from "@/lib/auth";
import SubmitButton from "../components/SubmitButton";
import {
  createAppointment,
  setAppointmentStatus,
  deleteAppointment,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  const scope = crmScope(user);
  const owners = await ownerNames();
  const [appointments, customers, employees] = await Promise.all([
    prisma.appointment.findMany({
      where: scope,
      orderBy: { startsAt: "asc" },
      include: { customer: true, employee: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...scope }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const now = new Date();
  const upcoming = appointments.filter(
    (a) => a.status === "SCHEDULED" && a.startsAt >= now,
  );

  const term = (q ?? "").toLowerCase();
  const list = term
    ? appointments.filter((a) =>
        [a.title, a.customer?.name, a.employee?.name, a.location]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
    : appointments;

  return (
    <div>
      <PageHeader
        title="Agendamentos"
        subtitle="Visitas e reuniões — vinculadas a clientes e à equipe"
        action={
          <div className="flex items-center gap-2">
            <SearchBar placeholder="Buscar por título, cliente..." defaultValue={q} />
            <Badge className="bg-brand-50 text-brand-700">
              {upcoming.length} próximo(s)
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo agendamento</h2>
          <form action={createAppointment} className="space-y-3">
            <div>
              <label className="label">Título *</label>
              <input name="title" required className="input" placeholder="Reunião de proposta..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select name="type" className="input" defaultValue="MEETING">
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {APPOINTMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Data e hora *</label>
                <input name="startsAt" type="datetime-local" required className="input" />
              </div>
            </div>
            <div>
              <label className="label">Cliente</label>
              <select name="customerId" className="input" defaultValue="">
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Responsável (equipe)</label>
              <select name="employeeId" className="input" defaultValue="">
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Local</label>
              <input name="location" className="input" placeholder="Escritório, online..." />
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <SubmitButton>Agendar</SubmitButton>
          </form>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Agendamento</th>
                <th className="th">Quando</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState>Nenhum agendamento.</EmptyState>
                  </td>
                </tr>
              ) : (
                list.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">
                          <Icon name={a.type === "VISIT" ? "customers" : "calendar"} size={15} />
                        </span>
                        <p className="font-medium text-slate-800">
                          {a.title}
                          {a.ownerId && <OwnerTag name={owners.get(a.ownerId)} />}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {APPOINTMENT_TYPE_LABELS[a.type]}
                        {a.customer ? ` · ${a.customer.name}` : ""}
                        {a.employee ? ` · ${a.employee.name}` : ""}
                        {a.location ? ` · ${a.location}` : ""}
                      </p>
                    </td>
                    <td className="td text-slate-600">{formatDateTime(a.startsAt)}</td>
                    <td className="td">
                      <Badge className={APPOINTMENT_STATUS_COLORS[a.status]}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <ShareToggle entity="appointment" id={a.id} shared={a.shared} canToggle={isAdmin(user) || a.ownerId === user?.id} />
                        {a.status === "SCHEDULED" && (
                          <>
                            <form action={setAppointmentStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value="DONE" />
                              <button className="btn-ghost px-2 py-1 text-xs" title="Concluir">
                                <Icon name="check" size={14} />
                              </button>
                            </form>
                            <form action={setAppointmentStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value="CANCELLED" />
                              <button className="btn-ghost px-2 py-1 text-xs" title="Cancelar">
                                <Icon name="close" size={14} />
                              </button>
                            </form>
                          </>
                        )}
                        <Link href={`/appointments/${a.id}`} className="btn-ghost px-2 py-1 text-xs" title="Editar">
                          <Icon name="edit" size={14} />
                        </Link>
                        <form action={deleteAppointment}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn-danger px-2 py-1 text-xs" title="Excluir">
                            <Icon name="trash" size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
