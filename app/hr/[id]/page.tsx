import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { updateEmployee } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await prisma.employee.findUnique({ where: { id: Number(id) } });
  if (!e) notFound();

  const hire = e.hireDate ? e.hireDate.toISOString().slice(0, 10) : "";

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar funcionário" subtitle={e.name} />

      <div className="card p-6">
        <form action={updateEmployee} className="space-y-3">
          <input type="hidden" name="id" value={e.id} />
          <div>
            <label className="label">Nome *</label>
            <input name="name" required defaultValue={e.name} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cargo</label>
              <input name="role" defaultValue={e.role ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Departamento</label>
              <input name="department" defaultValue={e.department ?? ""} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" defaultValue={e.email ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input name="phone" defaultValue={e.phone ?? ""} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo de contrato</label>
              <select name="contractType" defaultValue={e.contractType} className="input">
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
              </select>
            </div>
            <div>
              <label className="label">Comissão (%)</label>
              <input name="commissionPct" type="number" step="0.1" min="0" defaultValue={e.commissionPct} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Salário (R$)</label>
              <input name="salary" type="number" step="0.01" min="0" defaultValue={e.salary} className="input" />
            </div>
            <div>
              <label className="label">Admissão</label>
              <input name="hireDate" type="date" defaultValue={hire} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Benefícios</label>
            <input name="benefits" defaultValue={e.benefits ?? ""} className="input" placeholder="VR, VT, plano de saúde..." />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" defaultChecked={e.active} className="h-4 w-4" />
            Funcionário ativo
          </label>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/hr" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
