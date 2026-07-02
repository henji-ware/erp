import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { ShareToggle } from "../components/ShareToggle";
import { OwnerTag } from "../components/OwnerTag";
import { parsePage, paginate } from "@/lib/pagination";
import { getCurrentUser, isAdmin, crmScope, ownerNames } from "@/lib/auth";
import SubmitButton from "../components/SubmitButton";
import { createCustomer, deleteCustomer } from "./actions";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
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
                { name: { contains: q } },
                { company: { contains: q } },
                { email: { contains: q } },
                { document: { contains: q } },
              ],
            },
          ],
        }
      : scope),
  };

  const total = await prisma.customer.count({ where });
  const pg = paginate(total, parsePage(pageParam));

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pg.skip,
    take: pg.take,
    include: {
      _count: {
        select: {
          orders: true,
          projects: true,
          inspections: true,
          leads: true,
          transactions: true,
          appointments: true,
        },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Base de clientes do CRM, conectada a pedidos e financeiro"
        action={<SearchBar placeholder="Buscar por nome, CNPJ..." defaultValue={q} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Formulário de cadastro */}
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo cliente</h2>
          <form action={createCustomer} className="space-y-3">
            <div>
              <label className="label">Nome *</label>
              <input name="name" required className="input" placeholder="Razão social ou nome" />
            </div>
            <div>
              <label className="label">Empresa</label>
              <input name="company" className="input" />
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
            <div>
              <label className="label">CPF / CNPJ</label>
              <input name="document" className="input" />
            </div>
            <div>
              <label className="label">Endereço</label>
              <input name="address" className="input" placeholder="Rua, nº, bairro, cidade - UF" />
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <SubmitButton>Cadastrar cliente</SubmitButton>
          </form>
        </div>

        {/* Tabela */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Cliente</th>
                <th className="th">Contato</th>
                <th className="th">Pedidos</th>
                <th className="th">Desde</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhum cliente cadastrado.</EmptyState>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const linked =
                    c._count.orders +
                    c._count.projects +
                    c._count.inspections +
                    c._count.leads +
                    c._count.transactions +
                    c._count.appointments;
                  return (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <td className="td">
                      <p className="font-medium text-slate-800">
                        {c.name}
                        {c.ownerId && <OwnerTag name={owners.get(c.ownerId)} />}
                      </p>
                      {c.company && (
                        <p className="text-xs text-slate-400">{c.company}</p>
                      )}
                    </td>
                    <td className="td text-slate-500">
                      {c.email && <p>{c.email}</p>}
                      {c.phone && <p className="text-xs">{c.phone}</p>}
                      {!c.email && !c.phone && "—"}
                    </td>
                    <td className="td">{c._count.orders}</td>
                    <td className="td text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <ShareToggle entity="customer" id={c.id} shared={c.shared} canToggle={isAdmin(user) || c.ownerId === user?.id} />
                        <Link href={`/customers/${c.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                          <Icon name="edit" size={14} /> Editar
                        </Link>
                        <form action={deleteCustomer}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="btn-danger px-3 py-1.5 text-xs"
                            title={
                              linked > 0
                                ? "Cliente com registros vinculados não pode ser excluído"
                                : "Excluir"
                            }
                            disabled={linked > 0}
                          >
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
            basePath="/customers"
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
