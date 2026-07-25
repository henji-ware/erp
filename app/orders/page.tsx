import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { ShareToggle } from "../components/ShareToggle";
import { OwnerTag } from "../components/OwnerTag";
import { parsePage, paginate } from "@/lib/pagination";
import { getCurrentUser, isAdmin, crmScope, ownerNames } from "@/lib/auth";
import OrderForm from "./OrderForm";
import OrderStatusSelect from "./OrderStatusSelect";
import { deleteOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const user = await getCurrentUser();
  const scope = crmScope(user);
  const owners = await ownerNames();
  const where = {
    deletedAt: null,
    ...(q
      ? {
          AND: [
            scope,
            {
              OR: [
                { number: { contains: q } },
                { refCode: { contains: q } },
                { customer: { name: { contains: q } } },
                { seller: { name: { contains: q } } },
              ],
            },
          ],
        }
      : scope),
  };

  const total = await prisma.order.count({ where });
  const pg = paginate(total, parsePage(pageParam));

  const [orders, customers, products, employees] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pg.skip,
      take: pg.take,
      include: {
        customer: true,
        seller: true,
        items: { include: { product: true } },
      },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...scope }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const budgets = await prisma.lead.findMany({
    where: { deletedAt: null, number: { not: null }, ...scope },
    orderBy: { createdAt: "desc" },
    select: { number: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle="Ao confirmar, o estoque baixa e uma conta a receber é gerada no financeiro."
        action={<SearchBar placeholder="Buscar por nº, cliente, vendedor..." defaultValue={q} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <OrderForm
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            sellers={employees.map((e) => ({ id: e.id, name: e.name }))}
            budgets={budgets.map((b) => ({ number: b.number!, name: b.name }))}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              stock: p.stock,
              kind: p.kind,
            }))}
          />
        </div>

        <div className="card overflow-hidden lg:col-span-3">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Pedido</th>
                <th className="th">Cliente</th>
                <th className="th">Situação</th>
                <th className="th text-right">Total</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhum pedido ainda.</EmptyState>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="td">
                      <p className="font-medium text-slate-800">
                        {o.number}
                        {o.ownerId && <OwnerTag name={owners.get(o.ownerId)} />}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(o.createdAt)}
                        {o.refCode ? ` · Orç. ${o.refCode}` : ""}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {o.items.map((it) => (
                          <li key={it.id} className="text-xs text-slate-400">
                            {it.quantity}× {it.product.name}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="td text-slate-600">
                      {o.customer.name}
                      {o.seller && (
                        <span className="block text-xs text-slate-400">
                          Vend.: {o.seller.name}
                        </span>
                      )}
                      {o.deliveryAddress && (
                        <span className="block text-xs text-slate-400">
                          Entrega: {o.deliveryAddress}
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <OrderStatusSelect id={o.id} status={o.status} />
                    </td>
                    <td className="td text-right font-medium">
                      {formatCurrency(o.total)}
                    </td>
                    <td className="td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ShareToggle entity="order" id={o.id} shared={o.shared} canToggle={isAdmin(user) || o.ownerId === user?.id} />
                        <form action={deleteOrder}>
                          <input type="hidden" name="id" value={o.id} />
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
          <Pagination
            basePath="/orders"
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
