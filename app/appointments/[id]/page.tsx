import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/format";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { updateAppointment } from "../actions";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [appt, customers, employees] = await Promise.all([
    prisma.appointment.findUnique({ where: { id: Number(id) } }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!appt) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar agendamento" subtitle={appt.title} />

      <div className="card p-6">
        <form action={updateAppointment} className="space-y-3">
          <input type="hidden" name="id" value={appt.id} />
          <div>
            <label className="label">Título *</label>
            <input name="title" required defaultValue={appt.title} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select name="type" defaultValue={appt.type} className="input">
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{APPOINTMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data e hora *</label>
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInput(appt.startsAt)}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Cliente</label>
            <select name="customerId" defaultValue={appt.customerId ?? ""} className="input">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Responsável (equipe)</label>
            <select name="employeeId" defaultValue={appt.employeeId ?? ""} className="input">
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Local</label>
            <input name="location" defaultValue={appt.location ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="notes" rows={3} defaultValue={appt.notes ?? ""} className="input" />
          </div>
          <p className="text-xs text-slate-400">
            Status atual: {APPOINTMENT_STATUS_LABELS[appt.status]}
            {" "}(altere pela lista de agendamentos).
          </p>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/appointments" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
