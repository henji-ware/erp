"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth";
import { signToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { consumeRateLimit, requestIdentity } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (password.length > MAX_PASSWORD_LENGTH) redirect("/login?error=1");

  const ip = await requestIdentity();
  const ipRate = consumeRateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000);
  const accountRate = consumeRateLimit(`login-account:${ip}:${email}`, 5, 15 * 60 * 1000);
  if (!ipRate.allowed || !accountRate.allowed) redirect("/login?error=rate");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=1");
  }
  if (!user.active) {
    redirect("/login?error=inactive");
  }
  if (!user.emailVerified) {
    redirect("/login?error=verify");
  }

  const token = await signToken(String(user.id));
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
