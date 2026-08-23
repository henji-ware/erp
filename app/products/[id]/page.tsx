import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Alert, Badge } from "../../components/ui";
import { Icon } from "../../components/icons";
import SubmitButton from "../../components/SubmitButton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { STOCK_REASON_LABELS, STOCK_REASON_TONES } from "@/lib/stock";
import { updateProduct, adjustStock, receiveStock } from "../actions";

export const dynamic = "force-dynamic";

/** Quantas linhas do razão a tela mostra. */
const HISTORICO = 40;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  const [product, movements, suppliers] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: HISTORICO,
      include: { supplier: { select: { name: true } }, order: { select: { number: true } } },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  const isService = product.kind === "SERVICE";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Editar produto"
        subtitle={`${product.name} · ${product.sku}`}
        action={
          <Link href="/products" className="btn-ghost">
            Voltar
          </Link>
        }
      />

      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Dados do item</h2>
        <form action={updateProduct} className="space-y-3">
          <input type="hidden" name="id" value={product.id} />
          <div>
            <label className="label">Nome *</label>
            <input name="name" required defaultValue={product.name} className="input" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select name="kind" defaultValue={product.kind} className="input">
              <option value="PRODUCT">Produto</option>
              <option value="SERVICE">Serviço (sem estoque)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Preço venda (R$)</label>
              <input name="price" type="number" step="0.01" min="0" defaultValue={product.price} className="input" />
            </div>
            <div>
              <label className="label">Custo (R$)</label>
              <input name="cost" type="number" step="0.01" min="0" defaultValue={product.cost} className="input" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/products" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>

      {!isService && (
        <>
          {/* Saldo + entradas */}
          <div className="card mt-4 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-800">Estoque</h2>
              <span className="text-sm text-slate-500">
                Saldo atual:{" "}
                <strong
                  className={
                    product.stock < 0
                      ? "text-red-600"
                      : product.stock <= 5
                        ? "text-amber-600"
                        : "text-slate-800"
                  }
                >
                  {product.stock}
                </strong>
              </span>
            </div>

            {product.stock < 0 && (
              <Alert tone="danger" size="sm" className="mb-4">
                Saldo negativo. Isso acontece quando um pedido é confirmado
                acima do disponível — o sistema não bloqueia a venda. Faça a
                entrada da compra ou um acerto de inventário.
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Entrada por compra */}
              <form action={receiveStock} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <input type="hidden" name="id" value={product.id} />
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <span className="accent-icon"><Icon name="suppliers" size={14} /></span>
                  Entrada por compra
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Quantidade *</label>
                    <input name="quantity" type="number" min="1" required className="input" />
                  </div>
                  <div>
                    <label className="label">Custo unitário</label>
                    <input name="unitCost" type="number" step="0.01" min="0" className="input" placeholder={String(product.cost)} />
                  </div>
                </div>
                <div>
                  <label className="label">Fornecedor</label>
                  <select name="supplierId" defaultValue="" className="input">
                    <option value="">—</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Observação (nota fiscal, pedido…)</label>
                  <input name="note" className="input" placeholder="NF 12345" />
                </div>
                <SubmitButton className="btn-primary w-full">Registrar entrada</SubmitButton>
              </form>

              {/* Acerto manual */}
              <form action={adjustStock} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <input type="hidden" name="id" value={product.id} />
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <span className="accent-icon"><Icon name="edit" size={14} /></span>
                  Acerto de inventário
                </p>
                <div>
                  <label className="label">Diferença (use negativo para baixa)</label>
                  <input name="delta" type="number" required className="input" placeholder="-3" />
                </div>
                <div>
                  <label className="label">Motivo</label>
                  <input name="note" className="input" placeholder="Contagem, quebra, perda…" />
                </div>
                <p className="text-xs text-slate-400">
                  O acerto não deixa o saldo abaixo de zero.
                </p>
                <SubmitButton className="btn-ghost w-full">Aplicar acerto</SubmitButton>
              </form>
            </div>
          </div>

          {/* Razão */}
          <div className="card mt-4">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-800">Movimentações</h2>
              <span className="text-xs text-slate-400">
                {movements.length === HISTORICO ? `últimas ${HISTORICO}` : `${movements.length} no total`}
              </span>
            </div>

            {movements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Nenhuma movimentação registrada. O histórico começa a partir de
                agora — o saldo anterior a esta versão não tem lançamentos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="th">Quando</th>
                      <th className="th">Motivo</th>
                      <th className="th">Origem</th>
                      <th className="th text-right">Qtd.</th>
                      <th className="th text-right">Saldo</th>
                      <th className="th">Quem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50 last:border-0">
                        <td className="td whitespace-nowrap text-slate-500">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="td">
                          <Badge className={STOCK_REASON_TONES[m.reason]}>
                            {STOCK_REASON_LABELS[m.reason]}
                          </Badge>
                        </td>
                        <td className="td text-slate-500">
                          {m.order ? (
                            <Link href="/orders" className="hover:underline">
                              {m.order.number}
                            </Link>
                          ) : m.supplier ? (
                            m.supplier.name
                          ) : (
                            "—"
                          )}
                          {m.note && (
                            <span className="block text-xs text-slate-400">{m.note}</span>
                          )}
                          {m.unitCost != null && (
                            <span className="block text-xs text-slate-400">
                              {formatCurrency(m.unitCost)}/un
                            </span>
                          )}
                        </td>
                        <td
                          className={`td text-right font-semibold ${
                            m.quantity > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity}
                        </td>
                        <td className="td text-right font-medium">{m.balance}</td>
                        <td className="td text-slate-500">{m.userName ?? "sistema"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
