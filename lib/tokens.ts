import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "./prisma";

// Token longo para o LINK de verificação de e-mail (válido por 3 dias).
export async function createVerifyToken(userId: number): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await prisma.emailToken.create({ data: { userId, type: "VERIFY", code, expiresAt } });
  return code;
}

// Código de 6 dígitos para RESET de senha (válido por 15 min). Invalida os anteriores.
export async function createResetCode(userId: number): Promise<string> {
  await prisma.emailToken.updateMany({
    where: { userId, type: "RESET", usedAt: null },
    data: { usedAt: new Date() },
  });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.emailToken.create({ data: { userId, type: "RESET", code, expiresAt } });
  return code;
}

// Consome um token válido (não usado, não expirado). Retorna o userId ou null.
export async function consumeToken(
  type: "VERIFY" | "RESET",
  code: string,
  userId?: number,
): Promise<number | null> {
  const token = await prisma.emailToken.findFirst({
    where: {
      type,
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return null;
  await prisma.emailToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return token.userId;
}
