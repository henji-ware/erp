"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin, hashPassword } from "@/lib/auth";
import { asEnum, USER_ROLES } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { isEmailConfigured, sendEmail, emailLayout, emailButton } from "@/lib/email";
import { createVerifyToken } from "@/lib/tokens";
import { baseUrl } from "@/lib/url";

async function requireAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return isAdmin(user);
}

export async function createUser(formData: FormData) {
  if (!(await requireAdmin())) return;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 4) return;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return;

  // Se o envio de e-mail estiver configurado, exige verificação antes do 1º login.
  const requireVerify = isEmailConfigured();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: asEnum(USER_ROLES, formData.get("role"), "USER"),
      active: true,
      emailVerified: !requireVerify,
    },
  });
  await logAudit({ action: "CREATE", entity: "Usuário", entityId: user.id, summary: `Usuário "${name}" criado` });

  if (requireVerify) {
    const token = await createVerifyToken(user.id);
    const link = `${await baseUrl()}/verify?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Confirme seu e-mail — DRR Projetos",
      html: emailLayout(
        "Bem-vindo à DRR Projetos",
        `<p>Olá ${name}, sua conta foi criada. Confirme seu e-mail para liberar o acesso ao sistema.</p>
         ${emailButton("Confirmar e-mail", link)}
         <p style="font-size:12px;color:#94a3b8;">Se o botão não funcionar, copie e cole no navegador:<br>${link}</p>`,
      ),
    });
  }

  revalidatePath("/users");
}

export async function updateUser(formData: FormData) {
  if (!(await requireAdmin())) return;

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!id || !name || !email) return;

  const password = String(formData.get("password") ?? "");
  const role = asEnum(USER_ROLES, formData.get("role"), "USER");

  // Não permite remover o último admin (evita travar o sistema).
  if (role !== "ADMIN") {
    const current = await prisma.user.findUnique({ where: { id } });
    if (current?.role === "ADMIN") {
      const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) return;
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role,
      active: formData.get("active") === "on",
      ...(password.length >= 4 ? { passwordHash: hashPassword(password) } : {}),
    },
  });
  await logAudit({ action: "UPDATE", entity: "Usuário", entityId: id, summary: `Usuário "${name}" editado` });

  revalidatePath("/users");
  redirect("/users");
}

export async function deleteUser(formData: FormData) {
  if (!(await requireAdmin())) return;

  const id = Number(formData.get("id"));
  if (!id) return;

  const me = await getCurrentUser();
  if (me?.id === id) return; // não exclui a si mesmo

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) return; // não remove o último admin
  }

  // Mantém o histórico dos orçamentos: desvincula o dono antes de excluir.
  await prisma.lead.updateMany({ where: { ownerId: id }, data: { ownerId: null } });
  await prisma.user.delete({ where: { id } });
  await logAudit({ action: "DELETE", entity: "Usuário", entityId: id, summary: "Usuário excluído" });

  revalidatePath("/users");
}
