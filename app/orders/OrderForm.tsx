"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Icon } from "../components/icons";
import { createOrder } from "./actions";

type Customer = { id: number; name: string };
type Seller = { id: number; name: string };
type Budget = { number: string; name: string };
type Product = { id: number; name: string; price: number; stock: number; kind: string };

let rowSeq = 0;

export default function OrderForm({
  customers,
  products,
  sellers,
  budgets = [],
}: {
  customers: Customer[];
  products: Product[];
  sellers: Seller[];
  budgets?: Budget[];
}) {
  const [rows, setRows] = useState<{ key: number; productId: string; quantity: number }[]>(
    [{ key: rowSeq++, productId: "", quantity: 1 }],
  );

  const priceOf = (id: string) =>
    products.find((p) => String(p.id) === id)?.price ?? 0;

  const total = useMemo(
    () => rows.reduce((s, r) => s + priceOf(r.productId) * r.quantity, 0),
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const addRow = () =>
    setRows((r) => [...r, { key: rowSeq++, productId: "", quantity: 1 }]);
  const removeRow = (key: number) =>
    setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));
  const update = (key: number, patch: Partial<{ productId: string; quantity: number }>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const canSubmit =
    customers.length > 0 &&
    products.length > 0 &&
    rows.some((r) => r.productId && r.quantity > 0);

  return (
    <form action={createOrder} className="card p-5">
      <h2 className="mb-4 font-semibold text-slate-800">Novo pedido</h2>

      {customers.length === 0 || products.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Cadastre ao menos um cliente e um produto para criar pedidos.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Cliente *</label>
              <select name="customerId" required className="input" defaultValue="">
                <option value="" disabled>
                  Selecione...
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Vendedor</label>
              <select name="sellerId" className="input" defaultValue="">
                <option value="">—</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Orçamento de origem (código)</label>
              <select name="refCode" className="input" defaultValue="">
                <option value="">—</option>
                {budgets.map((b) => (
                  <option key={b.number} value={b.number}>
                    {b.number} · {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Endereço de entrega</label>
              <input
                name="deliveryAddress"
                className="input"
                placeholder="Rua, nº, bairro, cidade - UF (onde entregar/executar)"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Situação inicial</label>
              <select name="status" className="input" defaultValue="DRAFT">
                <option value="DRAFT">Rascunho (não mexe no estoque)</option>
                <option value="CONFIRMED">
                  Confirmar (baixa estoque + gera financeiro)
                </option>
              </select>
            </div>
          </div>

          <label className="label mt-4">Itens</label>
          <div className="space-y-2">
            {rows.map((r) => {
              const prod = products.find((p) => String(p.id) === r.productId);
              return (
                <div key={r.key} className="flex items-center gap-2">
                  <select
                    name="productId"
                    value={r.productId}
                    onChange={(e) => update(r.key, { productId: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">Produto...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.price)}
                        {p.kind === "SERVICE" ? " (serviço)" : ` (estq: ${p.stock})`}
                      </option>
                    ))}
                  </select>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    value={r.quantity}
                    onChange={(e) =>
                      update(r.key, { quantity: parseInt(e.target.value, 10) || 1 })
                    }
                    className="input w-20"
                  />
                  <span className="w-28 text-right text-sm font-medium text-slate-600">
                    {formatCurrency(priceOf(r.productId) * r.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    className="btn-danger px-2 py-1"
                    title="Remover item"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={addRow} className="btn-ghost mt-2 text-sm">
            <Icon name="plus" size={14} /> Adicionar item
          </button>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">Total do pedido</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(total)}</p>
          </div>

          <button type="submit" disabled={!canSubmit} className="btn-primary mt-4 w-full">
            Criar pedido
          </button>
        </>
      )}
    </form>
  );
}
