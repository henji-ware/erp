import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  formatDate,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
} from "@/lib/format";
import { PageHeader, EmptyState, Badge, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import SubmitButton from "../components/SubmitButton";
import ProjectStatusSelect from "./ProjectStatusSelect";
import { createProject, deleteProject } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [projects, customers, employees] = await Promise.all([
    prisma.project.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q } },
              { number: { contains: q } },
              { location: { contains: q } },
              { customer: { name: { contains: q } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: { customer: true, responsible: true },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const open = projects.filter((p) => !["CONCLUIDO", "CANCELADO"].includes(p.status));
  const inQuote = projects.filter((p) => p.status === "ORCAMENTO");
  const running = projects.filter((p) => p.status === "EM_EXECUCAO");
  const backlog = open.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <PageHeader
        title="Projetos / Obras"
        subtitle="Engenharia, montagem, remanejamento, manutenção, venda e locação"
        action={<SearchBar placeholder="Buscar por título, cliente..." defaultValue={q} />}
      />

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Em carteira" value={formatCurrency(backlog)} hint={`${open.length} ativos`} accent="text-brand-600" delay={0} />
        <StatCard label="Em orçamento" value={String(inQuote.length)} delay={60} />
        <StatCard label="Em execução" value={String(running.length)} accent="text-amber-600" delay={120} />
        <StatCard label="Total de projetos" value={String(projects.length)} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulário */}
        <div className="card h-fit p-5 xl:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo projeto / obra</h2>
          <form action={createProject} className="space-y-3">
            <div>
              <label className="label">Título *</label>
              <input name="title" required className="input" placeholder="Projeto CD - Verticalização" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select name="type" className="input" defaultValue="ENGENHARIA">
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input name="value" type="number" step="0.01" min="0" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Responsável</label>
              <select name="responsibleId" className="input" defaultValue="">
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Local / Endereço</label>
              <input name="location" className="input" placeholder="Cidade / CD do cliente" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Início</label>
                <input name="startDate" type="date" className="input" />
              </div>
              <div>
                <label className="label">Conclusão</label>
                <input name="endDate" type="date" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <SubmitButton>Criar projeto</SubmitButton>
          </form>
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Projeto</th>
                <th className="th">Tipo</th>
                <th className="th">Status</th>
                <th className="th text-right">Valor</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhum projeto cadastrado.</EmptyState>
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="td">
                      <p className="font-medium text-slate-800">{p.title}</p>
                      <p className="text-xs text-slate-400">
                        {p.number} · {p.customer.name}
                        {p.responsible ? ` · ${p.responsible.name}` : ""}
                      </p>
                      {(p.location || p.startDate) && (
                        <p className="text-xs text-slate-400">
                          {p.location ?? ""}
                          {p.startDate ? ` · início ${formatDate(p.startDate)}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="td">
                      <Badge className="bg-slate-100 text-slate-700">
                        {PROJECT_TYPE_LABELS[p.type]}
                      </Badge>
                    </td>
                    <td className="td">
                      <ProjectStatusSelect id={p.id} status={p.status} />
                    </td>
                    <td className="td text-right font-medium">{formatCurrency(p.value)}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/projects/${p.id}`} className="btn-ghost px-2 py-1 text-xs" title="Editar">
                          <Icon name="edit" size={14} />
                        </Link>
                        <form action={deleteProject}>
                          <input type="hidden" name="id" value={p.id} />
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
