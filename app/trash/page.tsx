import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { restoreItem, purgeItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const archived = { deletedAt: { not: null } };
  const [customers, products, suppliers, projects, leads] = await Promise.all([
    prisma.customer.findMany({
      where: { ...archived, ...(q ? { name: { contains: q } } : {}) },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.product.findMany({
      where: { ...archived, ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } : {}) },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.supplier.findMany({
      where: { ...archived, ...(q ? { name: { contains: q } } : {}) },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { ...archived, ...(q ? { OR: [{ title: { contains: q } }, { number: { contains: q } }] } : {}) },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { ...archived, ...(q ? { name: { contains: q } } : {}) },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const sections: { entity: string; title: string; items: { id: number; label: string; sub?: string; deletedAt: Date | null }[] }[] = [
    { entity: "customer", title: "Clientes", items: customers.map((c) => ({ id: c.id, label: c.name, sub: c.company ?? undefined, deletedAt: c.deletedAt })) },
    { entity: "project", title: "Projetos", items: projects.map((p) => ({ id: p.id, label: p.title, sub: p.number, deletedAt: p.deletedAt })) },
    { entity: "lead", title: "Orçamentos", items: leads.map((l) => ({ id: l.id, label: l.name, sub: l.source ?? undefined, deletedAt: l.deletedAt })) },
    { entity: "product", title: "Produtos / Serviços", items: products.map((p) => ({ id: p.id, label: p.name, sub: p.sku, deletedAt: p.deletedAt })) },
    { entity: "supplier", title: "Fornecedores", items: suppliers.map((s) => ({ id: s.id, label: s.name, sub: s.document ?? undefined, deletedAt: s.deletedAt })) },
  ];

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div>
      <PageHeader
        title="Lixeira"
        subtitle="Itens arquivados — restaure ou exclua definitivamente"
        action={<SearchBar placeholder="Buscar arquivados..." defaultValue={q} />}
      />

      {totalItems === 0 ? (
        <div className="card">
          <EmptyState>{q ? "Nenhum item arquivado corresponde à busca." : "A lixeira está vazia."}</EmptyState>
        </div>
      ) : (
        <div className="space-y-6">
          {sections
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <div key={sec.entity} className="card overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <h2 className="font-semibold text-slate-800">
                    {sec.title} <span className="text-slate-400">({sec.items.length})</span>
                  </h2>
                </div>
                <table className="w-full">
                  <tbody>
                    {sec.items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-50 last:border-0">
                        <td className="td">
                          <p className="font-medium text-slate-800">{it.label}</p>
                          {it.sub && <p className="text-xs text-slate-400">{it.sub}</p>}
                        </td>
                        <td className="td text-xs text-slate-400">
                          {it.deletedAt ? `arquivado ${formatDate(it.deletedAt)}` : ""}
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-1">
                            <form action={restoreItem}>
                              <input type="hidden" name="entity" value={sec.entity} />
                              <input type="hidden" name="id" value={it.id} />
                              <button className="btn-ghost px-3 py-1.5 text-xs" title="Restaurar">
                                <Icon name="history" size={14} /> Restaurar
                              </button>
                            </form>
                            <form action={purgeItem}>
                              <input type="hidden" name="entity" value={sec.entity} />
                              <input type="hidden" name="id" value={it.id} />
                              <button className="btn-danger px-3 py-1.5 text-xs" title="Excluir definitivamente">
                                <Icon name="trash" size={14} />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
