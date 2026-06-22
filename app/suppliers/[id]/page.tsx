import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
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
          <div>
            <label className="label">CPF / CNPJ</label>
            <input name="document" defaultValue={supplier.document ?? ""} className="input" />
          </div>
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
