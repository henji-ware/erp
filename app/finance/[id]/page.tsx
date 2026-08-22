import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  formatCurrency,
  formatDate,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  TX_STATUS_LABELS,
  TX_STATUS_COLORS,
} from "@/lib/format";
import { paidAmount, remaining } from "@/lib/finance";
import { getCurrentUser, canSee, crmScope } from "@/lib/auth";
import { PageHeader, Badge, Alert } from "../../components/ui";
import { Icon } from "../../components/icons";
import SubmitButton from "../../components/SubmitButton";
import { AttachmentsCard } from "../../components/AttachmentsCard";
import { InstallmentsCard } from "../InstallmentsCard";
import { updateTransaction, addPayment, deletePayment } from "../actions";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attach?: string }>;
}) {
  const { id } = await params;
  const { attach } = await searchParams;
  const txId = Number(id);
  const user = await getCurrentUser();
  const [tx, customers, suppliers] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: txId },
      include: {
        customer: true,
        supplier: true,
        order: true,
        payments: { orderBy: { paidAt: "desc" } },
        installments: { orderBy: { number: "asc" }, include: { payments: true } },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.customer.findMany({ where: { deletedAt: null, ...crmScope(user) }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  if (!tx || tx.deletedAt) notFound();
  // Usuário comum só acessa os próprios lançamentos (ou compartilhados).
  if (!canSee(user, tx)) notFound();

  const paid = paidAmount(tx);
  const left = remaining(tx);
  const hasInstallments = tx.installments.length > 0;
  const dueValue = tx.dueDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Lançamento"
        subtitle={tx.description}
        action={
          <Link href="/finance" className="btn-ghost">
            Voltar
          </Link>
        }
      />

      {/* Resumo */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Summary label="Valor" value={formatCurrency(tx.amount)} />
        <Summary label="Pago" value={formatCurrency(paid)} accent="text-green-600" />
        <Summary label="Saldo" value={formatCurrency(left)} accent={left > 0 ? "text-amber-600" : "text-slate-400"} />
        <div className="card flex flex-col justify-center p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
          <div className="mt-1">
            <Badge className={TX_STATUS_COLORS[tx.status]}>
              {TX_STATUS_LABELS[tx.status]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Edição */}
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-800">Dados do lançamento</h2>
          {tx.order && (
            <Alert tone="neutral" size="sm" className="mb-3">
              Gerado pelo pedido <strong>{tx.order.number}</strong>.
            </Alert>
          )}
          <form action={updateTransaction} className="space-y-3">
            <input type="hidden" name="id" value={tx.id} />
            <div>
              <label className="label">Descrição *</label>
              <input name="description" required defaultValue={tx.description} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select name="type" defaultValue={tx.type} className="input">
                  <option value="RECEIVABLE">A receber</option>
                  <option value="PAYABLE">A pagar</option>
                </select>
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={tx.amount}
                  disabled={hasInstallments}
                  className={`input ${hasInstallments ? "cursor-not-allowed opacity-60" : ""}`}
                />
              </div>
            </div>
            <div>
              <label className="label">Vencimento</label>
              <input
                name="dueDate"
                type="date"
                defaultValue={dueValue}
                disabled={hasInstallments}
                className={`input ${hasInstallments ? "cursor-not-allowed opacity-60" : ""}`}
              />
              {hasInstallments && (
                <p className="mt-1 text-xs text-slate-400">
                  Valor e vencimento vêm das parcelas.
                </p>
              )}
            </div>
            <div>
              <label className="label">Cliente (se a receber)</label>
              <select name="customerId" defaultValue={tx.customerId ?? ""} className="input">
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fornecedor (se a pagar)</label>
              <select name="supplierId" defaultValue={tx.supplierId ?? ""} className="input">
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <SubmitButton>Salvar alterações</SubmitButton>
          </form>
        </div>

        {/* Notas fiscais / comprovantes */}
        <AttachmentsCard
          ownerType="transaction"
          ownerId={tx.id}
          attachments={tx.attachments}
          title="Notas fiscais e comprovantes"
          hint="Anexe a NF (PDF ou XML) e comprovantes deste lançamento."
          accept=".pdf,.xml"
          error={attach}
        />

        {/* Parcelas */}
        <InstallmentsCard
          transactionId={tx.id}
          installments={tx.installments}
          totalAmount={tx.amount}
          firstDue={tx.dueDate}
        />

        {/* Pagamentos */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">Pagamentos</h2>
          {tx.installments.length > 0 && (
            <Alert tone="info" size="sm" className="mb-4">
              Este lançamento é parcelado — quite as parcelas no cronograma acima. O
              registro manual abaixo continua disponível para pagamentos avulsos.
            </Alert>
          )}

          {left > 0 ? (
            <form action={addPayment} className="mb-5 space-y-3 rounded-lg border border-slate-200 p-4">
              <input type="hidden" name="transactionId" value={tx.id} />
              <p className="text-sm font-medium text-slate-700">Registrar pagamento</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor (R$)</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={left}
                    defaultValue={left.toFixed(2)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Data</label>
                  <input name="paidAt" type="date" defaultValue={today} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Forma de pagamento</label>
                <select name="method" className="input" defaultValue="PIX">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <SubmitButton>Adicionar pagamento</SubmitButton>
            </form>
          ) : (
            <Alert tone="success" className="mb-5">
              Lançamento totalmente quitado.
            </Alert>
          )}

          {tx.payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              Nenhum pagamento registrado.
            </p>
          ) : (
            <ul className="space-y-2">
              {tx.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="text-slate-500">
                    <Icon name={PAYMENT_METHOD_ICONS[p.method]} size={18} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {formatCurrency(p.amount)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.paidAt)}
                    </p>
                  </div>
                  <form action={deletePayment}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <button className="btn-danger px-2 py-1 text-xs" title="Remover pagamento">
                      <Icon name="trash" size={14} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  accent = "text-slate-900",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}
