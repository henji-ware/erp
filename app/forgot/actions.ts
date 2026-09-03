"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, isValidNewPassword } from "@/lib/auth";
import { createResetCode, consumeToken } from "@/lib/tokens";
import { isEmailConfigured, sendEmail, emailLayout, emailCode } from "@/lib/email";
import { consumeRateLimit, requestIdentity } from "@/lib/rate-limit";

// Pede o código de redefinição: só envia se o e-mail estiver cadastrado e ativo.
export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/forgot");

  const ip = await requestIdentity();
  const rate = consumeRateLimit(`reset-request:${ip}:${email}`, 3, 15 * 60 * 1000);
  if (!rate.allowed) redirect(`/forgot?sent=1&email=${encodeURIComponent(email)}`);

  const user = await prisma.user.findUnique({ where: { email } });
  // A resposta é idêntica para contas existentes e inexistentes, impedindo
  // que a tela seja usada para descobrir os usuários cadastrados.
  if (!user || !user.active) {
    redirect(`/forgot?sent=1&email=${encodeURIComponent(email)}`);
  }
  if (!isEmailConfigured()) {
    redirect(`/forgot?sent=1&email=${encodeURIComponent(email)}`);
  }

  const code = await createResetCode(user.id);
  const ok = await sendEmail({
    to: email,
    subject: "Código para redefinir sua senha — DRR Projetos",
    html: emailLayout(
      "Redefinir senha",
      `<p>Use o código abaixo para criar uma nova senha. Ele expira em 15 minutos.</p>
       ${emailCode(code)}
       <p style="font-size:12px;color:#94a3b8;">Se você não solicitou, ignore este e-mail.</p>`,
    ),
  });

  // Se o provedor recusou o envio (ex.: domínio não verificado no Resend),
  // avisa em vez de mandar para a tela do código sem o e-mail ter saído.
  if (!ok) redirect(`/forgot?sent=1&email=${encodeURIComponent(email)}`);

  redirect(`/forgot?sent=1&email=${encodeURIComponent(email)}`);
}

// Confirma o código e troca a senha.
export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fail = `/reset?email=${encodeURIComponent(email)}&error=1`;
  if (!email || !code || !isValidNewPassword(password)) redirect(fail);

  const ip = await requestIdentity();
  const rate = consumeRateLimit(`reset-confirm:${ip}:${email}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) redirect(fail);

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
