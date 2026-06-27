import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  formatDate,
  TX_TYPE_LABELS,
  TX_STATUS_LABELS,
  TX_STATUS_COLORS,
} from "@/lib/format";
import { paidAmount, remaining, dueInfo } from "@/lib/finance";
import { PageHeader, EmptyState, Badge, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { parsePage, paginate } from "@/lib/pagination";
import SubmitButton from "../components/SubmitButton";
import {
  createTransaction,
  payRemaining,
  deleteTransaction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const [transactions, customers, suppliers] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { dueDate: "asc" },
      include: { customer: true, supplier: true, payments: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);

  // Os KPIs usam TODAS as transações; a tabela respeita a busca.
  const term = (q ?? "").toLowerCase();
  const filtered = term
    ? transactions.filter((t) =>
        [t.description, t.customer?.name, t.supplier?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
    : transactions;

  const pg = paginate(filtered.length, parsePage(pageParam));
  const pageItems = filtered.slice(pg.skip, pg.skip + pg.take);

  const byType = (t: string) => transactions.filter((x) => x.type === t);
  const sumPaid = (t: string) => byType(t).reduce((s, x) => s + paidAmount(x), 0);
  const sumRemaining = (t: string) => byType(t).reduce((s, x) => s + remaining(x), 0);

  const received = sumPaid("RECEIVABLE");
  const recPending = sumRemaining("RECEIVABLE");
  const payPending = sumRemaining("PAYABLE");

  // Vencidos (não pagos, com vencimento já passado)
  const overdue = transactions.filter((t) => dueInfo(t.dueDate, t.status)?.overdue);
  const overdueValue = overdue.reduce((s, t) => s + remaining(t), 0);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Agende contas a pagar/receber, acompanhe vencimentos e dê baixa (inclusive parcial)"
        action={<SearchBar placeholder="Buscar por descrição, cliente..." defaultValue={q} />}
      />

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="A receber (saldo)" value={formatCurrency(recPending)} accent="text-green-600" delay={0} />
        <StatCard label="A pagar (saldo)" value={formatCurrency(payPending)} accent="text-red-600" delay={60} />
        <StatCard
          label="Vencidos"
          value={formatCurrency(overdueValue)}
          hint={`${overdue.length} em atraso`}
          accent={overdueValue > 0 ? "text-red-600" : "text-slate-400"}
          delay={120}
        />
        <StatCard label="Recebido" value={formatCurrency(received)} delay={180} />
        <StatCard
          label="Saldo projetado"
          value={formatCurrency(recPending - payPending)}
          accent={recPending - payPending >= 0 ? "text-green-600" : "text-red-600"}
          delay={240}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo lançamento</h2>
          <form action={createTransaction} className="space-y-3">
            <div>
              <label className="label">Descrição *</label>
              <input name="description" required className="input" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select name="type" className="input" defaultValue="PAYABLE">
                <option value="RECEIVABLE">A receber</option>
                <option value="PAYABLE">A pagar</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Valor (R$)</label>
                <input name="amount" type="number" step="0.01" min="0" className="input" />
              </div>
              <div>
                <label className="label">Vencimento</label>
                <input name="dueDate" type="date" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Cliente (se a receber)</label>
              <select name="customerId" className="input" defaultValue="">
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fornecedor (se a pagar)</label>
              <select name="supplierId" className="input" defaultValue="">
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton>Lançar</SubmitButton>
          </form>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">Descrição</th>
                <th className="th">Tipo</th>
                <th className="th text-right">Valor</th>
                <th className="th text-right">Pago</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>Nenhum lançamento.</EmptyState>
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => {
                  const paid = paidAmount(t);
                  const left = remaining(t);
                  const who = t.customer?.name ?? t.supplier?.name;
                  const due = dueInfo(t.dueDate, t.status);
                  return (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0">
                      <td className="td">
                        <p className="font-medium text-slate-800">{t.description}</p>
                        <p className="text-xs text-slate-400">
                          venc. {formatDate(t.dueDate)}
                          {who ? ` · ${who}` : ""}
                        </p>
                        {due && <p className={`text-xs ${due.cls}`}>{due.text}</p>}
                      </td>
                      <td className="td">
                        <Badge
                          className={
                            t.type === "RECEIVABLE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }
                        >
                          {TX_TYPE_LABELS[t.type]}
                        </Badge>
                      </td>
                      <td className="td text-right font-medium">{formatCurrency(t.amount)}</td>
                      <td className="td text-right text-slate-500">
                        {formatCurrency(paid)}
                        {left > 0 && paid > 0 && (
                          <span className="block text-xs text-amber-600">
                            falta {formatCurrency(left)}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <Badge className={TX_STATUS_COLORS[t.status]}>
                          {TX_STATUS_LABELS[t.status]}
                        </Badge>
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          {left > 0 && (
                            <form action={payRemaining}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="method" value="CASH" />
                              <button
                                className="btn-ghost px-2 py-1 text-xs"
                                title="Quitar restante em dinheiro"
                              >
                                <Icon name="check" size={14} /> Quitar
                              </button>
                            </form>
                          )}
                          <Link
                            href={`/finance/${t.id}`}
                            className="btn-ghost px-2 py-1 text-xs"
                            title="Pagamentos e detalhes"
                          >
                            <Icon name="card" size={14} />
                          </Link>
                          <form action={deleteTransaction}>
                            <input type="hidden" name="id" value={t.id} />
                            <button className="btn-danger px-2 py-1 text-xs">
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
            basePath="/finance"
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
