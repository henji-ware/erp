import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  PROJECT_TYPE_OPTIONS,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  formatCurrency,
  formatDate,
  TX_STATUS_LABELS,
  TX_STATUS_COLORS,
} from "@/lib/format";
import { PageHeader, Badge } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { AttachmentsCard } from "../../components/AttachmentsCard";
import { Icon } from "../../components/icons";
import { updateProject, invoiceProject } from "../actions";
import { getCurrentUser, canSee, crmScope } from "@/lib/auth";

export const dynamic = "force-dynamic";

const d = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attach?: string }>;
}) {
  const { id } = await params;
  const { attach } = await searchParams;
  const user = await getCurrentUser();
  const [project, customers, employees] = await Promise.all([
    prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        attachments: { orderBy: { createdAt: "desc" } },
        transactions: { where: { deletedAt: null }, orderBy: { dueDate: "asc" } },
      },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...crmScope(user) }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!project) notFound();
  if (!canSee(user, project)) notFound();

  const invoiced = project.transactions.reduce((s, t) => s + t.amount, 0);
  const remainingToInvoice = Math.max(0, project.value - invoiced);

  // Inclui o tipo atual mesmo que seja um tipo "legado" (Inspeção, Venda...),
  // para não trocá-lo sem querer ao editar um projeto antigo.
  const typeOptions = (PROJECT_TYPE_OPTIONS as readonly string[]).includes(project.type)
    ? [...PROJECT_TYPE_OPTIONS]
    : [project.type, ...PROJECT_TYPE_OPTIONS];

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
                {typeOptions.map((t) => (
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
          error={attach}
        />
      </div>

      {/* Faturamento do projeto (vínculo com o financeiro) */}
      <div className="card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">Faturamento</h2>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">
              Valor: <strong className="text-slate-800">{formatCurrency(project.value)}</strong>
            </span>
            <span className="text-slate-500">
              Faturado: <strong className="text-green-600">{formatCurrency(invoiced)}</strong>
            </span>
            <span className="text-slate-500">
              A faturar: <strong className="text-brand-600">{formatCurrency(remainingToInvoice)}</strong>
            </span>
          </div>
        </div>

        <form action={invoiceProject} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input type="hidden" name="projectId" value={project.id} />
          <div className="sm:col-span-2">
            <label className="label">Descrição</label>
            <input name="description" className="input" placeholder={`Ex.: Medição 1 — ${project.number}`} />
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input name="amount" type="number" step="0.01" min="0" className="input" placeholder={String(remainingToInvoice || project.value)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">Vencimento</label>
              <input name="dueDate" type="date" className="input" />
            </div>
            <SubmitButton>
              <Icon name="finance" size={15} /> Faturar
            </SubmitButton>
          </div>
        </form>

        {project.transactions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Nenhuma cobrança gerada para este projeto ainda. Em branco, o valor usa o total do projeto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">Descrição</th>
                  <th className="th">Vencimento</th>
                  <th className="th text-right">Valor</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {project.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0">
                    <td className="td font-medium text-slate-800">{t.description}</td>
                    <td className="td text-slate-500">{formatDate(t.dueDate)}</td>
                    <td className="td text-right font-medium">{formatCurrency(t.amount)}</td>
                    <td className="td">
                      <Badge className={TX_STATUS_COLORS[t.status]}>{TX_STATUS_LABELS[t.status]}</Badge>
                    </td>
                    <td className="td text-right">
                      <Link href={`/finance/${t.id}`} className="btn-ghost px-2 py-1 text-xs" title="Ver no financeiro">
                        <Icon name="arrowRight" size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
