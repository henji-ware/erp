import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, RENTAL_STATUS_COLORS, RENTAL_STATUS_LABELS } from "@/lib/format";
import { PageHeader, EmptyState, Badge, StatCard, Alert } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { ShareToggle } from "../components/ShareToggle";
import { OwnerTag } from "../components/OwnerTag";
import { parsePage, paginate } from "@/lib/pagination";
import { getCurrentUser, isAdmin, crmScope, ownerNames } from "@/lib/auth";
import SubmitButton from "../components/SubmitButton";
import RentalStatusSelect from "./RentalStatusSelect";
import { createRental, deleteRental } from "./actions";

export const dynamic = "force-dynamic";

export default async function RentalsPage({
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
                { product: { name: { contains: q } } },
              ],
            },
          ],
        }
      : scope),
  };

  // KPIs sobre as locações ativas visíveis ao usuário.
  const activeRentals = await prisma.rental.findMany({
    where: { deletedAt: null, status: "ACTIVE", ...scope },
  });
  const monthlyRevenue = activeRentals.reduce((s, r) => s + r.monthlyRate * r.quantity, 0);
  const now = new Date();
  const overdue = activeRentals.filter((r) => r.expectedEnd && r.expectedEnd < now).length;

  const total = await prisma.rental.count({ where });
  const pg = paginate(total, parsePage(pageParam));

  const [rentals, customers, products] = await Promise.all([
    prisma.rental.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pg.skip,
      take: pg.take,
      include: { customer: true, product: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...scope }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { deletedAt: null, rentable: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const budgets = await prisma.lead.findMany({
    where: { deletedAt: null, number: { not: null }, ...scope },
    orderBy: { createdAt: "desc" },
    select: { number: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="Locações"
        subtitle="Aluguel de equipamentos — controle de saída, devolução e faturamento mensal"
        action={<SearchBar placeholder="Buscar por nº, cliente, equipamento..." defaultValue={q} />}
      />

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Em locação" value={String(activeRentals.length)} accent="text-blue-600" delay={0} />
        <StatCard label="Receita mensal" value={formatCurrency(monthlyRevenue)} hint="Locações ativas" accent="text-green-600" delay={60} />
        <StatCard label="Atrasadas" value={String(overdue)} accent={overdue > 0 ? "text-red-600" : "text-slate-400"} delay={120} />
        <StatCard label="Total" value={String(total)} delay={180} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulário */}
        <div className="card h-fit p-5 xl:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Nova locação</h2>
          {products.length === 0 ? (
            <Alert tone="warn" size="sm">
              Nenhum equipamento marcado como locável. Em Produtos, marque o item como
              disponível para locação.
            </Alert>
          ) : (
            <form action={createRental} className="space-y-3">
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
                <label className="label">Equipamento *</label>
                <select name="productId" required className="input" defaultValue="">
                  <option value="" disabled>Selecione...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantidade</label>
                  <input name="quantity" type="number" min="1" defaultValue={1} className="input" />
                </div>
                <div>
                  <label className="label">Valor mensal (R$)</label>
                  <input name="monthlyRate" type="number" step="0.01" min="0" className="input" placeholder="por unidade" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Início *</label>
                  <input name="startDate" type="date" required className="input" />
                </div>
                <div>
                  <label className="label">Devolução prevista</label>
                  <input name="expectedEnd" type="date" className="input" />
                </div>
              </div>
              <div>
                <label className="label">Orçamento de origem (código)</label>
                <select name="refCode" className="input" defaultValue="">
                  <option value="">—</option>
                  {budgets.map((b) => (
                    <option key={b.number} value={b.number!}>
                      {b.number} · {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Endereço de entrega</label>
                <input name="deliveryAddress" className="input" placeholder="Rua, nº, bairro, cidade - UF" />
              </div>
              <div>
                <label className="label">Observações</label>
                <textarea name="notes" rows={2} className="input" />
              </div>
              <SubmitButton>Registrar locação</SubmitButton>
            </form>
          )}
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">Locação</th>
                  <th className="th">Período</th>
                  <th className="th text-right">Mensal</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {rentals.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState>Nenhuma locação registrada.</EmptyState>
                    </td>
                  </tr>
                ) : (
                  rentals.map((r) => {
                    const isOverdue = r.status === "ACTIVE" && r.expectedEnd && r.expectedEnd < now;
                    return (
                      <tr key={r.id} className="border-b border-slate-50 align-top last:border-0">
                        <td className="td">
                          <p className="font-medium text-slate-800">
                            {r.product.name}
                            {r.ownerId && <OwnerTag name={owners.get(r.ownerId)} />}
                          </p>
                          <p className="text-xs text-slate-400">
                            {r.number} · {r.customer.name} · {r.quantity}x
                            {r.refCode ? ` · Orç. ${r.refCode}` : ""}
                          </p>
                          {r.deliveryAddress && (
                            <p className="text-xs text-slate-400">Entrega: {r.deliveryAddress}</p>
                          )}
                        </td>
                        <td className="td text-slate-600">
                          {formatDate(r.startDate)}
                          {r.expectedEnd && (
                            <span className={`block text-xs ${isOverdue ? "text-red-600 font-medium" : "text-slate-400"}`}>
                              {isOverdue ? "venceu " : "até "}
                              {formatDate(r.expectedEnd)}
                            </span>
                          )}
                          {r.returnedAt && (
                            <span className="block text-xs text-green-600">
                              devolvido {formatDate(r.returnedAt)}
                            </span>
                          )}
                        </td>
                        <td className="td text-right font-medium">
                          {formatCurrency(r.monthlyRate * r.quantity)}
                        </td>
                        <td className="td">
                          {isOverdue ? (
                            <Badge className={RENTAL_STATUS_COLORS.OVERDUE}>
                              {RENTAL_STATUS_LABELS.OVERDUE}
                            </Badge>
                          ) : (
                            <RentalStatusSelect id={r.id} status={r.status} />
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-1">
                            <ShareToggle entity="rental" id={r.id} shared={r.shared} canToggle={isAdmin(user) || r.ownerId === user?.id} />
                            <form action={deleteRental}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="btn-danger px-2 py-1 text-xs" title="Excluir">
                                <Icon name="trash" size={14} />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            basePath="/rentals"
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
