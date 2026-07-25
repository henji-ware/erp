import { formatCurrency } from "@/lib/format";
import { Icon } from "../components/icons";
import SubmitButton from "../components/SubmitButton";
import { addLeadItem, deleteLeadItem } from "./actions";

type Item = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
};

// Itens (produtos/serviços) do orçamento. O total substitui o campo "Valor"
// do orçamento sempre que houver ao menos um item.
export function LeadItemsCard({
  leadId,
  items,
  products,
}: {
  leadId: number;
  items: Item[];
  products: { id: number; name: string; price: number; kind: string }[];
}) {
  const total = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  return (
    <div className="card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Itens do orçamento</h2>
        {items.length > 0 && (
          <span className="text-sm font-bold text-brand-600">{formatCurrency(total)}</span>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Escolha do catálogo ou escreva um item livre. O total vira o valor do orçamento.
      </p>

      <form action={addLeadItem} className="mb-4 space-y-2 rounded-lg border border-slate-200 p-3">
        <input type="hidden" name="leadId" value={leadId} />
        <div>
          <label className="label">Produto / serviço do catálogo</label>
          <select name="productId" className="input" defaultValue="">
            <option value="">— item livre (descreva abaixo)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.price)}
                {p.kind === "SERVICE" ? " (serviço)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Descrição (opcional se escolheu do catálogo)</label>
          <input name="description" className="input" placeholder="Ex.: Montagem de mezanino" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Qtde</label>
            <input name="quantity" type="number" min="1" defaultValue={1} className="input" />
          </div>
          <div>
            <label className="label">Valor unit. (R$)</label>
            <input name="unitPrice" type="number" step="0.01" min="0" className="input" placeholder="do catálogo" />
          </div>
        </div>
        <SubmitButton>
          <Icon name="plus" size={14} /> Adicionar item
        </SubmitButton>
      </form>

      {items.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-400">
          Nenhum item — o orçamento usa o valor digitado ao lado.
        </p>
      ) : (
        <table className="w-full">
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-slate-50 last:border-0">
                <td className="td">
                  <p className="text-sm font-medium text-slate-800">{it.description}</p>
                  <p className="text-xs text-slate-400">
                    {it.quantity} × {formatCurrency(it.unitPrice)}
                  </p>
                </td>
                <td className="td text-right font-medium">
                  {formatCurrency(it.unitPrice * it.quantity)}
                </td>
                <td className="td text-right">
                  <form action={deleteLeadItem}>
                    <input type="hidden" name="id" value={it.id} />
                    <button className="btn-danger px-2 py-1 text-xs" title="Remover item">
                      <Icon name="close" size={14} />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
