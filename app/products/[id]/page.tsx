import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { updateProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!product) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar produto" subtitle={`${product.name} · ${product.sku}`} />

      <div className="card p-6">
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
          <div>
            <label className="label">Estoque</label>
            <input name="stock" type="number" min="0" defaultValue={product.stock} className="input" />
          </div>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/products" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
