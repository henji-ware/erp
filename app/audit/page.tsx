import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_COLORS } from "@/lib/audit";
import { notFound } from "next/navigation";
import { parsePage, paginate } from "@/lib/pagination";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { PageHeader, EmptyState, Badge } from "../components/ui";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!isAdmin(await getCurrentUser())) notFound();
  const sp = await searchParams;
  const q = sp.q;
  const page = parsePage(sp.page);

  const where = q
    ? {
        OR: [
          { summary: { contains: q } },
          { entity: { contains: q } },
          { userName: { contains: q } },
        ],
      }
    : undefined;

  const total = await prisma.auditLog.count({ where });
  const pg = paginate(total, page);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pg.skip,
    take: pg.take,
  });

  return (
    <div>
      <PageHeader
        title="Auditoria"
        subtitle="Histórico de quem criou, alterou ou excluiu registros no sistema"
        action={<SearchBar placeholder="Buscar por registro, usuário..." defaultValue={q} />}
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Quando</th>
                <th className="th">Usuário</th>
                <th className="th">Ação</th>
                <th className="th">Registro</th>
                <th className="th">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhum evento registrado ainda.</EmptyState>
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0">
                    <td className="td whitespace-nowrap text-slate-500">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="td text-slate-700">{l.userName ?? "—"}</td>
                    <td className="td">
                      <Badge className={AUDIT_ACTION_COLORS[l.action] ?? "bg-slate-100 text-slate-700"}>
                        {AUDIT_ACTION_LABELS[l.action] ?? l.action}
                      </Badge>
                    </td>
                    <td className="td text-slate-600">
                      {l.entity}
                      {l.entityId ? <span className="text-slate-400"> #{l.entityId}</span> : null}
                    </td>
                    <td className="td text-slate-600">{l.summary ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          basePath="/audit"
          page={pg.page}
          totalPages={pg.totalPages}
          from={pg.from}
          to={pg.to}
          total={pg.total}
          params={{ q }}
        />
      </div>
    </div>
  );
}
