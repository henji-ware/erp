import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { USER_ROLES, USER_ROLE_LABELS } from "@/lib/format";
import { PageHeader } from "../../components/ui";
import SubmitButton from "../../components/SubmitButton";
import { updateUser } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCurrentUser();
  if (!isAdmin(me)) notFound();

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar usuário" subtitle={user.email} />

      <div className="card p-6">
        <form action={updateUser} className="space-y-3">
          <input type="hidden" name="id" value={user.id} />
          <div>
            <label className="label">Nome *</label>
            <input name="name" required defaultValue={user.name} className="input" />
          </div>
          <div>
            <label className="label">E-mail *</label>
            <input name="email" type="email" required defaultValue={user.email} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Papel</label>
              <select name="role" defaultValue={user.role} className="input">
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="active" defaultChecked={user.active} className="h-4 w-4" />
                Ativo
              </label>
            </div>
          </div>
          <div>
            <label className="label">Nova senha (deixe em branco para manter)</label>
            <input name="password" type="text" minLength={4} className="input" placeholder="••••" />
          </div>
          <div className="flex gap-2 pt-2">
            <SubmitButton>Salvar alterações</SubmitButton>
            <Link href="/users" className="btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
