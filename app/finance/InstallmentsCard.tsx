import { formatCurrency, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { dueInfo } from "@/lib/finance";
import { Icon } from "../components/icons";
import { Alert } from "../components/ui";
import SubmitButton from "../components/SubmitButton";
import {
  generateInstallments,
  updateInstallment,
  addInstallment,
  deleteInstallment,
  payInstallment,
  clearInstallments,
} from "./actions";

type Installment = {
  id: number;
  number: number;
  amount: number;
  dueDate: Date;
  payments: { amount: number }[];
};

const d = (date: Date) => date.toISOString().slice(0, 10);

// Cronograma de parcelas do lançamento: gerar, editar valor/data de cada uma,
// acrescentar, remover e quitar individualmente.
export function InstallmentsCard({
  transactionId,
  installments,
  totalAmount,
  firstDue,
}: {
  transactionId: number;
  installments: Installment[];
  totalAmount: number;
  firstDue: Date;
}) {
  const has = installments.length > 0;
  const sum = installments.reduce((s, i) => s + i.amount, 0);
  const diff = Math.round((sum - totalAmount) * 100) / 100;

  return (
    <div className="card p-6 lg:col-span-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-800">
          Parcelas {has && <span className="text-slate-400">({installments.length}x)</span>}
        </h2>
        {has && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              Soma: <strong className="text-slate-800">{formatCurrency(sum)}</strong>
            </span>
            <form action={clearInstallments}>
              <input type="hidden" name="transactionId" value={transactionId} />
              <button className="btn-ghost px-2 py-1 text-xs" title="Remover parcelamento">
                Tornar à vista
              </button>
            </form>
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Um único lançamento com o cronograma abaixo. Você pode ajustar o valor e a data
        de cada parcela.
      </p>

      {/* Gerar / regerar cronograma */}
      <form
        action={generateInstallments}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3"
      >
        <input type="hidden" name="transactionId" value={transactionId} />
        <div>
          <label className="label">Nº de parcelas</label>
          <input
            name="count"
            type="number"
            min="1"
            max="60"
            defaultValue={has ? installments.length : 2}
            className="input w-24"
          />
        </div>
        <div>
          <label className="label">1º vencimento</label>
          <input name="firstDue" type="date" defaultValue={d(firstDue)} className="input" />
        </div>
        <SubmitButton className="btn-ghost">
          <Icon name="calendar" size={14} /> {has ? "Regerar" : "Parcelar"}
        </SubmitButton>
        {has && (
          <p className="w-full text-xs text-amber-600">
            Regerar substitui as parcelas atuais (divide o total igualmente).
          </p>
        )}
      </form>

      {!has ? (
        <p className="py-3 text-center text-sm text-slate-400">
          Lançamento à vista — use o campo acima para dividir em parcelas.
        </p>
      ) : (
        <>
          {diff !== 0 && (
            <Alert tone="warn" size="sm" className="mb-3">
              A soma das parcelas está {diff > 0 ? "acima" : "abaixo"} do valor do lançamento
              em {formatCurrency(Math.abs(diff))} — ajuste os valores (o total do lançamento
              acompanha a soma).
            </Alert>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Valor</th>
                  <th className="th">Vencimento</th>
                  <th className="th">Situação</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {installments.map((it) => {
                  const paid = it.payments.reduce((s, p) => s + p.amount, 0);
                  const left = Math.round((it.amount - paid) * 100) / 100;
                  const isPaid = left <= 0;
                  const due = isPaid ? null : dueInfo(it.dueDate, "PENDING");
                  return (
                    <tr key={it.id} className="border-b border-slate-50 last:border-0">
                      <td className="td font-medium text-slate-700">{it.number}</td>
                      <td className="td" colSpan={2}>
                        {/* Edição inline de valor + vencimento */}
                        <form action={updateInstallment} className="flex items-center gap-2">
                          <input type="hidden" name="installmentId" value={it.id} />
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={it.amount}
                            disabled={isPaid}
                            className="input w-28 py-1 text-sm"
                          />
                          <input
                            name="dueDate"
                            type="date"
                            defaultValue={d(it.dueDate)}
                            disabled={isPaid}
                            className="input w-36 py-1 text-sm"
                          />
                          {!isPaid && (
                            <button className="btn-ghost px-2 py-1 text-xs" title="Salvar parcela">
                              <Icon name="check" size={14} />
                            </button>
                          )}
                        </form>
                      </td>
                      <td className="td">
                        {isPaid ? (
                          <span className="text-xs font-medium text-green-600">Paga</span>
                        ) : (
                          <>
                            <span className="text-xs text-amber-600">
                              {formatCurrency(left)} em aberto
                            </span>
                            {due && <span className={`block text-xs ${due.cls}`}>{due.text}</span>}
                          </>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          {!isPaid && (
                            <form action={payInstallment} className="flex items-center gap-1">
                              <input type="hidden" name="installmentId" value={it.id} />
                              <select name="method" defaultValue="PIX" className="input w-24 py-1 text-xs">
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                                ))}
                              </select>
                              <button className="btn-ghost px-2 py-1 text-xs" title="Quitar parcela">
                                Quitar
                              </button>
                            </form>
                          )}
                          <form action={deleteInstallment}>
                            <input type="hidden" name="installmentId" value={it.id} />
                            <button className="btn-danger px-2 py-1 text-xs" title="Remover parcela">
                              <Icon name="trash" size={14} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form action={addInstallment} className="mt-3">
            <input type="hidden" name="transactionId" value={transactionId} />
            <button className="btn-ghost text-sm">
              <Icon name="plus" size={14} /> Acrescentar parcela
            </button>
          </form>
        </>
      )}
    </div>
  );
}
