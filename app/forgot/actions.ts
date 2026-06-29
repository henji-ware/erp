"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createResetCode, consumeToken } from "@/lib/tokens";
import { isEmailConfigured, sendEmail, emailLayout, emailCode } from "@/lib/email";

// Pede o código de redefinição: envia para o e-mail (se existir e estiver ativo).
export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/forgot");

  const user = await prisma.user.findUnique({ where: { email } });
  // Não revela se o e-mail existe — sempre segue para a tela do código.
  if (user && user.active && isEmailConfigured()) {
    const code = await createResetCode(user.id);
    await sendEmail({
      to: email,
      subject: "Código para redefinir sua senha — DRR Projetos",
      html: emailLayout(
        "Redefinir senha",
        `<p>Use o código abaixo para criar uma nova senha. Ele expira em 15 minutos.</p>
         ${emailCode(code)}
         <p style="font-size:12px;color:#94a3b8;">Se você não solicitou, ignore este e-mail.</p>`,
      ),
    });
  }

  redirect(`/reset?email=${encodeURIComponent(email)}`);
}

// Confirma o código e troca a senha.
export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fail = `/reset?email=${encodeURIComponent(email)}&error=1`;
  if (!email || !code || password.length < 4) redirect(fail);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect(fail);

  const userId = await consumeToken("RESET", code, user.id);
  if (!userId) redirect(fail);

  await prisma.user.update({
    where: { id: userId },
    // Trocar a senha também confirma o e-mail (chegou no código => e-mail real).
    data: { passwordHash: hashPassword(password), emailVerified: true },
  });

  redirect("/login?reset=1");
}
