import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SUPPLIER_CATEGORIES, SUPPLIER_CATEGORY_LABELS } from "@/lib/format";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import DocumentInput from "../../components/DocumentInput";
import { updateSupplier } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id: Number(id) } });
  if (!supplier) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar fornecedor" subtitle={supplier.name} />

      <div className="card p-6">
        <form action={updateSupplier} className="space-y-3">
          <input type="hidden" name="id" value={supplier.id} />
          <div>
            <label className="label">Nome *</label>
            <input name="name" required defaultValue={supplier.name} className="input" />
          </div>
          <DocumentInput defaultValue={supplier.document ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" defaultValue={supplier.email ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input name="phone" defaultValue={supplier.phone ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Tipo de fornecedor</label>
            <select name="category" defaultValue={supplier.category ?? ""} className="input">
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
              defaultValue={supplier.products ?? ""}
              className="input"
              placeholder="Ex.: perfis de aço, chapas galvanizadas, parafusos"
            />
          </div>
          <div>
            <label className="label">Serviços prestados</label>
            <textarea
              name="services"
              rows={2}
              defaultValue={supplier.services ?? ""}
              className="input"
              placeholder="Ex.: corte e dobra, pintura eletrostática, frete"
            />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="notes" rows={3} defaultValue={supplier.notes ?? ""} className="input" />
          </div>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/suppliers" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
