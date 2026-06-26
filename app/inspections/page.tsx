import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatDateTime,
  RISK_LEVELS,
  RISK_LABELS,
  RISK_COLORS,
} from "@/lib/format";
import { PageHeader, EmptyState, Badge, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { parsePage, paginate } from "@/lib/pagination";
import SubmitButton from "../components/SubmitButton";
import InspectionStatusSelect from "./InspectionStatusSelect";
import { createInspection, deleteInspection } from "./actions";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const where = q
    ? {
        OR: [
          { location: { contains: q } },
          { engineer: { contains: q } },
          { artNumber: { contains: q } },
          { customer: { name: { contains: q } } },
        ],
      }
    : undefined;

  // Cards calculados sobre todas as inspeções (independente da busca).
  const [scheduled, reports, critical, totalAll, totalFiltered, customers] =
    await Promise.all([
      prisma.inspection.count({ where: { status: "AGENDADA" } }),
      prisma.inspection.count({ where: { status: "LAUDO_EMITIDO" } }),
      prisma.inspection.count({ where: { riskLevel: "VERMELHO" } }),
      prisma.inspection.count(),
      prisma.inspection.count({ where }),
      prisma.customer.findMany({ orderBy: { name: "asc" } }),
    ]);

  const pg = paginate(totalFiltered, parsePage(pageParam));
  const list = await prisma.inspection.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    skip: pg.skip,
    take: pg.take,
    include: { customer: true },
  });

  return (
    <div>
      <PageHeader
        title="Inspeções / Laudos"
        subtitle="Vistorias técnicas com classificação de risco e ART (NBR 17.150 / NR-11)"
        action={<SearchBar placeholder="Buscar por cliente, ART..." defaultValue={q} />}
      />

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Agendadas" value={String(scheduled)} accent="text-blue-600" delay={0} />
        <StatCard label="Laudos emitidos" value={String(reports)} accent="text-green-600" delay={60} />
        <StatCard label="Risco crítico (vermelho)" value={String(critical)} accent="text-red-600" delay={120} />
        <StatCard label="Total" value={String(totalAll)} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulário */}
        <div className="card h-fit p-5 xl:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Nova inspeção</h2>
          <form action={createInspection} className="space-y-3">
            <div>
              <label className="label">Cliente *</label>
              <select name="customerId" required className="input" defaultValue="">
                <option value="" disabled>Selecione...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data e hora *</label>
              <input name="scheduledAt" type="datetime-local" required className="input" />
            </div>
            <div>
              <label className="label">Local / Endereço</label>
              <input name="location" className="input" placeholder="CD / galpão do cliente" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Engenheiro</label>
                <input name="engineer" className="input" placeholder="Eng. responsável" />
              </div>
              <div>
                <label className="label">Nº da ART</label>
                <input name="artNumber" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Classificação de risco</label>
              <select name="riskLevel" className="input" defaultValue="">
                <option value="">— (definir após vistoria)</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{RISK_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Achados / Observações</label>
              <textarea name="findings" rows={2} className="input" />
            </div>
            <SubmitButton>Registrar inspeção</SubmitButton>
          </form>
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Cliente / Local</th>
                <th className="th">Quando</th>
                <th className="th">Risco</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhuma inspeção encontrada.</EmptyState>
                  </td>
                </tr>
              ) : (
                list.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="td">
                      <p className="font-medium text-slate-800">{i.customer.name}</p>
                      <p className="text-xs text-slate-400">
                        {i.location ?? "—"}
                        {i.engineer ? ` · ${i.engineer}` : ""}
                        {i.artNumber ? ` · ART ${i.artNumber}` : ""}
                      </p>
                    </td>
                    <td className="td text-slate-600">{formatDateTime(i.scheduledAt)}</td>
                    <td className="td">
                      {i.riskLevel ? (
                        <Badge className={RISK_COLORS[i.riskLevel]}>
                          {i.riskLevel}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      <InspectionStatusSelect id={i.id} status={i.status} />
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/inspections/${i.id}`} className="btn-ghost px-2 py-1 text-xs" title="Editar / Laudo">
                          <Icon name="edit" size={14} />
                        </Link>
                        <form action={deleteInspection}>
                          <input type="hidden" name="id" value={i.id} />
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
          <Pagination
            basePath="/inspections"
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
