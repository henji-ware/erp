import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { formatCurrency, USER_ROLES, USER_ROLE_LABELS, USER_ROLE_COLORS } from "@/lib/format";
import { PageHeader, EmptyState, Badge } from "../components/ui";
import { Icon } from "../components/icons";
import SubmitButton from "../components/SubmitButton";
import { createUser, deleteUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!isAdmin(me)) notFound();

  const [users, leadStats] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { _count: { select: { leads: true } } },
    }),
    // Análise dos perfis: orçamentos ganhos (valor) por dono.
    prisma.lead.groupBy({
      by: ["ownerId"],
      where: { stage: "WON", deletedAt: null },
      _sum: { value: true },
      _count: { _all: true },
    }),
  ]);

  const wonByUser = new Map(
    leadStats.map((s) => [s.ownerId, { value: s._sum.value ?? 0, count: s._count._all }]),
  );

  return (
    <div>
      <PageHeader
        title="Usuários e acesso"
        subtitle="Crie logins, defina papéis e acompanhe o desempenho de cada perfil"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Novo usuário */}
        <div className="card h-fit p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-800">Novo usuário</h2>
          <form action={createUser} className="space-y-3">
            <div>
              <label className="label">Nome *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">E-mail *</label>
              <input name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label">Senha *</label>
              <input name="password" type="text" required minLength={4} className="input" placeholder="mín. 4 caracteres" />
            </div>
            <div>
              <label className="label">Papel</label>
              <select name="role" className="input" defaultValue="USER">
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <SubmitButton>Criar usuário</SubmitButton>
          </form>
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
            <strong>Administrador</strong> vê e gerencia tudo. <strong>Usuário</strong> vê
            e edita apenas os próprios orçamentos.
          </p>
        </div>

        {/* Lista de usuários */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">Usuário</th>
                  <th className="th">Papel</th>
                  <th className="th text-center">Orçamentos</th>
                  <th className="th text-right">Ganhos</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState>Nenhum usuário cadastrado.</EmptyState>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const won = wonByUser.get(u.id);
                    return (
                      <tr key={u.id} className="border-b border-slate-50 last:border-0">
                        <td className="td">
                          <p className="flex items-center gap-2 font-medium text-slate-800">
                            {u.name}
                            {!u.active && <Badge className="bg-slate-100 text-slate-500">Inativo</Badge>}
                            {u.id === me?.id && <Badge className="bg-brand-50 text-brand-700">você</Badge>}
                          </p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </td>
                        <td className="td">
                          <Badge className={USER_ROLE_COLORS[u.role]}>{USER_ROLE_LABELS[u.role]}</Badge>
                        </td>
                        <td className="td text-center">{u._count.leads}</td>
                        <td className="td text-right">
                          {won ? (
                            <>
                              <span className="font-medium text-green-600">{formatCurrency(won.value)}</span>
                              <span className="block text-xs text-slate-400">{won.count} ganho(s)</span>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/users/${u.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                              <Icon name="edit" size={14} /> Editar
                            </Link>
                            {u.id !== me?.id && (
                              <form action={deleteUser}>
                                <input type="hidden" name="id" value={u.id} />
                                <button className="btn-danger px-3 py-1.5 text-xs" title="Excluir">
                                  <Icon name="trash" size={14} />
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
