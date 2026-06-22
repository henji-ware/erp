import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { updateCustomer } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
  });
  if (!customer) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar cliente" subtitle={customer.name} />

      <div className="card p-6">
        <form action={updateCustomer} className="space-y-3">
          <input type="hidden" name="id" value={customer.id} />
          <div>
            <label className="label">Nome *</label>
            <input name="name" required defaultValue={customer.name} className="input" />
          </div>
          <div>
            <label className="label">Empresa</label>
            <input name="company" defaultValue={customer.company ?? ""} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" defaultValue={customer.email ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input name="phone" defaultValue={customer.phone ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label">CPF / CNPJ</label>
            <input name="document" defaultValue={customer.document ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className="input" />
          </div>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/customers" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
