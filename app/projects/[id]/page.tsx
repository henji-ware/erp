import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/format";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { AttachmentsCard } from "../../components/AttachmentsCard";
import { updateProject } from "../actions";

export const dynamic = "force-dynamic";

const d = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, customers, employees] = await Promise.all([
    prisma.project.findUnique({
      where: { id: Number(id) },
      include: { attachments: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!project) notFound();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Editar projeto"
        subtitle={`${project.number} · ${PROJECT_STATUS_LABELS[project.status]}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <form action={updateProject} className="space-y-3">
          <input type="hidden" name="id" value={project.id} />
          <div>
            <label className="label">Título *</label>
            <input name="title" required defaultValue={project.title} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cliente *</label>
              <select name="customerId" required defaultValue={project.customerId} className="input">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select name="type" defaultValue={project.type} className="input">
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsável</label>
              <select name="responsibleId" defaultValue={project.responsibleId ?? ""} className="input">
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input name="value" type="number" step="0.01" min="0" defaultValue={project.value} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Local / Endereço</label>
            <input name="location" defaultValue={project.location ?? ""} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Início</label>
              <input name="startDate" type="date" defaultValue={d(project.startDate)} className="input" />
            </div>
            <div>
              <label className="label">Conclusão</label>
              <input name="endDate" type="date" defaultValue={d(project.endDate)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="notes" rows={3} defaultValue={project.notes ?? ""} className="input" />
          </div>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/projects" className="btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>

        <AttachmentsCard
          ownerType="project"
          ownerId={project.id}
          attachments={project.attachments}
          title="Documentos do projeto"
          hint="Contratos, ARTs, plantas, relatórios (PDF ou Word)."
        />
      </div>
    </div>
  );
}
