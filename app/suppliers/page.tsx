import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_CATEGORY_SHORT,
} from "@/lib/format";
import { remaining } from "@/lib/finance";
import { PageHeader, EmptyState, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import SubmitButton from "../components/SubmitButton";
import DocumentInput from "../components/DocumentInput";
import { createSupplier, deleteSupplier } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const suppliers = await prisma.supplier.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { document: { contains: q } },
              { products: { contains: q } },
              { services: { contains: q } },
            ],
          }
        : {}),
    },
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
            <DocumentInput />
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
              <label className="label">Tipo de fornecedor</label>
              <select name="category" className="input" defaultValue="">
                <option value="">— (sem tipo)</option>
                {SUPPLIER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{SUPPLIER_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">O que vende</label>
              <textarea
                name="products"
                rows={2}
                className="input"
                placeholder="Ex.: perfis de aço, chapas galvanizadas, parafusos"
              />
            </div>
            <div>
              <label className="label">Serviços prestados</label>
              <textarea
                name="services"
                rows={2}
                className="input"
                placeholder="Ex.: corte e dobra, pintura eletrostática, frete"
              />
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <SubmitButton>Cadastrar fornecedor</SubmitButton>
          </form>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Fornecedor</th>
                <th className="th">Fornece</th>
                <th className="th">Contato</th>
                <th className="th text-right">Saldo a pagar</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>Nenhum fornecedor cadastrado.</EmptyState>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => {
                  const open = s.transactions.reduce((acc, t) => acc + remaining(t), 0);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="td">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
                          {s.name}
                          {s.category && (
                            <Badge className="bg-brand-50 text-brand-700">
                              {SUPPLIER_CATEGORY_SHORT[s.category]}
                            </Badge>
                          )}
                        </p>
                        {s.document && (
                          <p className="text-xs text-slate-400">{s.document}</p>
                        )}
                      </td>
                      <td className="td max-w-[220px] text-slate-600">
                        {s.products && (
                          <p className="truncate text-xs" title={s.products}>
                            <span className="text-slate-400">Vende:</span> {s.products}
                          </p>
                        )}
                        {s.services && (
                          <p className="truncate text-xs" title={s.services}>
                            <span className="text-slate-400">Serviços:</span> {s.services}
                          </p>
                        )}
                        {!s.products && !s.services && <span className="text-slate-400">—</span>}
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
    </div>
  );
}
