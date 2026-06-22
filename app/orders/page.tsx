import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/ui";
import { Icon } from "../components/icons";
import OrderForm from "./OrderForm";
import OrderStatusSelect from "./OrderStatusSelect";
import { deleteOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, customers, products, employees] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        seller: true,
        items: { include: { product: true } },
      },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle="Ao confirmar, o estoque baixa e uma conta a receber é gerada no financeiro."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <OrderForm
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            sellers={employees.map((e) => ({ id: e.id, name: e.name }))}
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
                      <p className="font-medium text-slate-800">{o.number}</p>
                      <p className="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
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
                    </td>
                    <td className="td">
                      <OrderStatusSelect id={o.id} status={o.status} />
                    </td>
                    <td className="td text-right font-medium">
                      {formatCurrency(o.total)}
                    </td>
                    <td className="td text-right">
                      <form action={deleteOrder}>
                        <input type="hidden" name="id" value={o.id} />
                        <button className="btn-danger px-3 py-1.5 text-xs" title="Excluir">
                          <Icon name="trash" size={14} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
