import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { verifyToken, SESSION_COOKIE } from "./session";

// ---- Senhas (scrypt, sem dependências externas) ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, "hex");
  return ref.length === test.length && timingSafeEqual(ref, test);
}

// ---- Sessão (server components / actions) ----

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const userId = await verifyToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  // O cookie vale 7 dias: sem esta checagem, desativar um usuário só teria
  // efeito no próximo login. Inativo (ou excluído) perde a sessão na hora.
  return user?.active ? user : null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function isAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === "ADMIN";
}

// Cláusula de visibilidade (CRM/vendas): admin vê tudo ({}); usuário comum vê
// os próprios registros OU os marcados como compartilhados.
// Use dentro de `where`: { deletedAt: null, ...crmScope(user) }.
// Quando houver busca (outro OR), combine com AND: { AND: [crmScope(user), { OR: [...busca] }] }.
export function crmScope(
  user: { id: number; role: string } | null | undefined,
): { OR?: ({ ownerId: number } | { shared: boolean })[] } {
  // Sem usuário (sessão de conta excluída/desativada) não é "vê tudo": filtra
  // por um dono que não existe, então a consulta não devolve nada.
  if (!user) return { OR: [{ ownerId: -1 }] };
  if (user.role === "ADMIN") return {};
  return { OR: [{ ownerId: user.id }, { shared: true }] };
}

// Alias mantido por compatibilidade.
export const ownerScope = crmScope;

// O usuário pode ver este registro? (admin, dono ou compartilhado)
export function canSee(
  user: { id: number; role: string } | null | undefined,
  record: { ownerId: number | null; shared: boolean },
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (record.shared) return true;
  return record.ownerId === user.id;
}

// O usuário pode editar/excluir? (admin ou dono — compartilhado não dá edição)
export function canEdit(
  user: { id: number; role: string } | null | undefined,
  record: { ownerId: number | null },
): boolean {
  if (isAdmin(user)) return true;
  return !!user && record.ownerId === user.id;
}

// Guarda de autorização para server actions: o usuário atual pode alterar
// este registro? (admin sempre; usuário comum só o que é dele).
// Use nas actions de update/delete para impedir acesso por ID forjado.
export async function canEditRecord(
  record: { ownerId: number | null } | null | undefined,
): Promise<boolean> {
  if (!record) return false;
  return canEdit(await getCurrentUser(), record);
}

// Mapa id->nome dos usuários, para exibir "adicionado por" nos registros.
export async function ownerNames(): Promise<Map<number, string>> {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name] as const));
}
