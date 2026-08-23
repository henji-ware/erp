import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, PRODUCT_KIND_LABELS } from "@/lib/format";
import { PageHeader, EmptyState, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { parsePage, paginate } from "@/lib/pagination";
import SubmitButton from "../components/SubmitButton";
import { createProduct, deleteProduct, adjustStock } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { category: { contains: q } },
          ],
        }
      : {}),
  };

  const total = await prisma.product.count({ where });
  const pg = paginate(total, parsePage(pageParam));

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    skip: pg.skip,
    take: pg.take,
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Produtos e Serviços"
        subtitle="Catálogo de produtos e serviços. Só produtos controlam estoque."
        action={<SearchBar placeholder="Buscar por nome, SKU..." defaultValue={q} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo item</h2>
          <form action={createProduct} className="space-y-3">
            <div>
              <label className="label">Nome *</label>
              <input name="name" required className="input" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select name="kind" className="input" defaultValue="PRODUCT">
                  <option value="PRODUCT">Produto</option>
                  <option value="SERVICE">Serviço</option>
                </select>
              </div>
              <div>
                <label className="label">SKU (opcional)</label>
                <input name="sku" className="input" placeholder="Automático" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Preço venda (R$)</label>
                <input name="price" type="number" step="0.01" min="0" className="input" />
              </div>
              <div>
                <label className="label">Custo (R$)</label>
                <input name="cost" type="number" step="0.01" min="0" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Estoque inicial</label>
              <input name="stock" type="number" min="0" defaultValue={0} className="input" />
            </div>
            <SubmitButton>Cadastrar produto</SubmitButton>
          </form>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Produto</th>
                <th className="th">Preço</th>
                <th className="th">Estoque</th>
                <th className="th text-center">Ajuste</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhum produto cadastrado.</EmptyState>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        {p.kind === "SERVICE" && (
                          <Badge className="bg-brand-50 text-brand-700">
                            {PRODUCT_KIND_LABELS.SERVICE}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{p.sku}</p>
                    </td>
                    <td className="td">{formatCurrency(p.price)}</td>
                    <td className="td">
                      {p.kind === "SERVICE" ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge
                          className={
                            p.stock <= 5
                              ? "badge-tone badge-danger"
                              : "badge-tone badge-success"
                          }
                        >
                          {p.stock} un.
                        </Badge>
                      )}
                    </td>
                    <td className="td">
                      {p.kind === "SERVICE" ? (
                        <p className="text-center text-slate-400">—</p>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <form action={adjustStock}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="delta" value={-1} />
                            <input type="hidden" name="note" value="Ajuste rápido na listagem" />
                            <button className="btn-ghost h-7 w-7 p-0" title="Diminuir">
                              <Icon name="minus" size={14} />
                            </button>
                          </form>
                          <form action={adjustStock}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="delta" value={1} />
                            <input type="hidden" name="note" value="Ajuste rápido na listagem" />
                            <button className="btn-ghost h-7 w-7 p-0" title="Aumentar">
                              <Icon name="plus" size={14} />
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/products/${p.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                          <Icon name="edit" size={14} /> Editar
                        </Link>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            className="btn-danger px-3 py-1.5 text-xs"
                            disabled={p._count.items > 0}
                            title={
                              p._count.items > 0
                                ? "Produto usado em pedidos"
                                : "Excluir"
                            }
                          >
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
            basePath="/products"
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
