import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  SELLER_CATEGORIES,
  SELLER_CATEGORY_LABELS,
} from "@/lib/format";
import { PageHeader, EmptyState, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import SubmitButton from "../components/SubmitButton";
import { createEmployee, deleteEmployee } from "./actions";

export const dynamic = "force-dynamic";

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const employees = await prisma.employee.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { role: { contains: q } },
            { department: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { sales: true } } },
  });

  const active = employees.filter((e) => e.active);
  const payroll = active.reduce((s, e) => s + e.salary, 0);

  return (
    <div>
      <PageHeader
        title="RH / Equipe"
        subtitle="Funcionários e vendedores — contrato, comissão e benefícios"
        action={<SearchBar placeholder="Buscar por nome, cargo..." defaultValue={q} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo funcionário</h2>
          <form action={createEmployee} className="space-y-3">
            <div>
              <label className="label">Nome *</label>
              <input name="name" required className="input" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Cargo</label>
                <input name="role" className="input" placeholder="Vendedor..." />
              </div>
              <div>
                <label className="label">Departamento</label>
                <input name="department" className="input" placeholder="Comercial..." />
              </div>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select name="category" className="input" defaultValue="">
                <option value="">— (sem categoria)</option>
                {SELLER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{SELLER_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">E-mail</label>
                <input name="email" type="email" className="input" />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input name="phone" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo de contrato</label>
                <select name="contractType" className="input" defaultValue="CLT">
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                </select>
              </div>
              <div>
                <label className="label">Comissão (%)</label>
                <input name="commissionPct" type="number" step="0.1" min="0" className="input" placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Meta de valor (R$/mês)</label>
                <input name="targetValue" type="number" step="0.01" min="0" className="input" placeholder="opcional" />
              </div>
              <div>
                <label className="label">Meta de qtde (vendas/mês)</label>
                <input name="targetQty" type="number" min="0" className="input" placeholder="opcional" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Salário (R$)</label>
                <input name="salary" type="number" step="0.01" min="0" className="input" />
              </div>
              <div>
                <label className="label">Admissão</label>
                <input name="hireDate" type="date" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Benefícios</label>
              <input name="benefits" className="input" placeholder="VR, VT, plano de saúde..." />
            </div>
            <SubmitButton>Cadastrar</SubmitButton>
          </form>

          <div className="mt-5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
            Folha (ativos): <strong>{formatCurrency(payroll)}</strong> ·{" "}
            {active.length} ativo(s)
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Funcionário</th>
                <th className="th">Cargo</th>
                <th className="th text-right">Salário</th>
                <th className="th text-center">Vendas</th>
                <th className="th">Benefícios</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>Nenhum funcionário cadastrado.</EmptyState>
                  </td>
                </tr>
              ) : (
                employees.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="td">
                      <p className="flex items-center gap-2 font-medium text-slate-800">
                        {e.name}
                        <Badge
                          className={
                            e.contractType === "PJ"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }
                        >
                          {e.contractType}
                        </Badge>
                        {!e.active && (
                          <Badge className="bg-slate-100 text-slate-500">Inativo</Badge>
                        )}
                      </p>
                      {e.email && <p className="text-xs text-slate-400">{e.email}</p>}
                    </td>
                    <td className="td text-slate-600">
                      {e.category ? (
                        <Badge className="bg-brand-50 text-brand-700">
                          {SELLER_CATEGORY_LABELS[e.category]}
                        </Badge>
                      ) : (
                        e.role ?? "—"
                      )}
                      {(e.role || e.department) && (
                        <span className="block text-xs text-slate-400">
                          {[e.category ? e.role : null, e.department].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="td text-right">
                      {formatCurrency(e.salary)}
                      {e.commissionPct > 0 && (
                        <span className="block text-xs text-slate-400">
                          + {e.commissionPct}% comissão
                        </span>
                      )}
                    </td>
                    <td className="td text-center">{e._count.sales}</td>
                    <td className="td">
                      {e.benefits ? (
                        <details className="group">
                          <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                            <Icon name="plus" size={12} className="group-open:hidden" />
                            <span className="group-open:hidden">Ver</span>
                            <span className="hidden group-open:inline">Ocultar</span>
                          </summary>
                          <p className="mt-1 max-w-[220px] whitespace-pre-line text-xs text-slate-500">
                            {e.benefits}
                          </p>
                        </details>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/hr/${e.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                          <Icon name="edit" size={14} /> Editar
                        </Link>
                        <form action={deleteEmployee}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="btn-danger px-3 py-1.5 text-xs" title="Excluir">
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
