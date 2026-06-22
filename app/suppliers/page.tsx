import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { remaining } from "@/lib/finance";
import { PageHeader, EmptyState } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import SubmitButton from "../components/SubmitButton";
import { createSupplier, deleteSupplier } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const suppliers = await prisma.supplier.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { document: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      transactions: { where: { type: "PAYABLE" }, include: { payments: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores, ligado às contas a pagar do financeiro"
        action={<SearchBar placeholder="Buscar por nome, CNPJ..." defaultValue={q} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo fornecedor</h2>
          <form action={createSupplier} className="space-y-3">
            <div>
              <label className="label">Nome *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">CPF / CNPJ</label>
              <input name="document" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <label className="label">Observações</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <SubmitButton>Cadastrar fornecedor</SubmitButton>
          </form>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Fornecedor</th>
                <th className="th">Contato</th>
                <th className="th text-right">Saldo a pagar</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState>Nenhum fornecedor cadastrado.</EmptyState>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => {
                  const open = s.transactions.reduce((acc, t) => acc + remaining(t), 0);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="td">
                        <p className="font-medium text-slate-800">{s.name}</p>
                        {s.document && (
                          <p className="text-xs text-slate-400">{s.document}</p>
                        )}
                      </td>
                      <td className="td text-slate-500">
                        {s.email && <p>{s.email}</p>}
                        {s.phone && <p className="text-xs">{s.phone}</p>}
                        {!s.email && !s.phone && "—"}
                      </td>
                      <td className="td text-right font-medium">
                        {open > 0 ? formatCurrency(open) : "—"}
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/suppliers/${s.id}`}
                            className="btn-ghost px-3 py-1.5 text-xs"
                          >
                            <Icon name="edit" size={14} /> Editar
                          </Link>
                          <form action={deleteSupplier}>
                            <input type="hidden" name="id" value={s.id} />
                            <button
                              className="btn-danger px-3 py-1.5 text-xs"
                              disabled={s.transactions.length > 0}
                              title={
                                s.transactions.length > 0
                                  ? "Fornecedor com lançamentos"
                                  : "Excluir"
                              }
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
      </div>
    </div>
  );
}
