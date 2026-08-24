// Chaves de API por usuário — leitura e escrita, sempre no servidor.
//
// REGRA CENTRAL: a chave em claro só existe em dois momentos — quando o
// usuário a digita e a envia para salvar, e quando o servidor a decifra para
// chamar o provedor. Ela nunca volta para o navegador e nunca aparece numa
// resposta de API.
//
// Por isso este módulo expõe DUAS leituras separadas:
//   - `listCredentials`  → o que a tela pode ver (provedor, dica, URL base);
//   - `resolveApiKey`    → a chave de verdade, para uso interno das rotas.
//
// Manter as duas com nomes distintos é proposital: um `getCredentials` que
// devolvesse tudo acabaria, mais cedo ou mais tarde, serializado num JSON de
// resposta por descuido.

import { prisma } from "@/lib/prisma";
import { AI_PROVIDERS, isAIProviderId } from "./providers";
import { AIProviderId } from "./types";
import { canStoreSecrets, decryptSecret, encryptSecret, secretHint } from "./crypto";

/** O que pode ser mostrado na tela. Note que NÃO existe campo com a chave. */
export interface CredentialView {
  provider: AIProviderId;
  hint: string;
  baseUrl: string | null;
  updatedAt: Date;
  /** A chave está guardada mas o servidor não consegue mais lê-la. */
  broken: boolean;
}

export { canStoreSecrets };

/** Credenciais do usuário, sem os segredos. */
export async function listCredentials(userId: number): Promise<CredentialView[]> {
  const rows = await prisma.aICredential.findMany({
    where: { userId },
    orderBy: { provider: "asc" },
  });

  return rows.filter((r) => isAIProviderId(r.provider)).map((r) => ({
    provider: r.provider as AIProviderId,
    hint: r.keyHint,
    baseUrl: r.baseUrl,
    updatedAt: r.updatedAt,
    // Se o segredo mestre mudou, a linha continua lá mas não decifra mais.
    // Dizer isso na tela é melhor que deixar a IA falhar sem explicação.
    broken: decryptSecret(r.keyCipher) === null,
  }));
}

/** Guarda (ou substitui) a chave de um provedor. Devolve só a dica. */
export async function saveCredential(
  userId: number,
  provider: AIProviderId,
  apiKey: string,
  baseUrl?: string | null,
): Promise<{ hint: string }> {
  const key = apiKey.trim();
  if (!key) throw new Error("Chave vazia.");

  // Lança MissingEncryptionSecret se não houver segredo — guardar em claro
  // seria pior que não guardar.
  const keyCipher = encryptSecret(key);
  const keyHint = secretHint(key);
  const url = baseUrl?.trim() || null;

  await prisma.aICredential.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, keyCipher, keyHint, baseUrl: url },
    update: { keyCipher, keyHint, baseUrl: url },
  });

  return { hint: keyHint };
}

export async function deleteCredential(
  userId: number,
  provider: AIProviderId,
): Promise<void> {
  await prisma.aICredential.deleteMany({ where: { userId, provider } });
}

/**
 * A chave que uma chamada deve usar, em ordem de precedência:
 *
 *   1. a chave guardada DESTE usuário;
 *   2. a variável de ambiente do servidor (chave da empresa, se houver).
 *
 * A chave que vem do corpo da requisição NÃO entra aqui de propósito. O
 * navegador não precisa mais mandá-la, e aceitar uma chave do cliente numa
 * rota de uso normal reabriria o caminho que esta mudança fecha.
 *
 * A exceção é o cadastro: ao digitar uma chave nova, a pessoa quer testá-la
 * antes de salvar — as rotas /api/ai/test e /api/ai/models recebem a chave
 * digitada explicitamente, e só elas.
 */
export async function resolveApiKey(
  userId: number,
  provider: AIProviderId,
): Promise<string | undefined> {
  const row = await prisma.aICredential.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { keyCipher: true },
  });

  if (row) {
    const key = decryptSecret(row.keyCipher);
    if (key) return key;
    // Não decifrou (segredo mestre trocado): cai para o ambiente em vez de
    // falhar. A tela avisa que a chave precisa ser cadastrada de novo.
  }

  return envApiKey(provider);
}

/** URL base própria do usuário, quando houver. */
export async function resolveBaseUrl(
  userId: number,
  provider: AIProviderId,
): Promise<string | undefined> {
  const row = await prisma.aICredential.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { baseUrl: true },
  });
  return row?.baseUrl?.trim() || undefined;
}

/** Chave da empresa, do .env do servidor. */
export function envApiKey(provider: AIProviderId): string | undefined {
  const envVar = AI_PROVIDERS[provider]?.keyEnvVar;
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  if (fromEnv) return fromEnv;

  // Único alias que não é derivável do keyEnvVar do provedor.
  if (provider === "gemini") return process.env.GOOGLE_API_KEY?.trim() || undefined;

  return undefined;
}
