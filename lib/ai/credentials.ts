// Chaves de API por usuário — leitura e escrita, sempre no servidor.
//
// REGRA CENTRAL: a chave em claro só existe em dois momentos — quando o
// usuário a digita e a envia para salvar, e quando o servidor a decifra para
// chamar o provedor. Ela nunca volta para o navegador e nunca aparece numa
// resposta de API.
//
// Por isso este módulo expõe DUAS leituras separadas:
//   - `listCredentials`  → o que a tela pode ver (provedor, dica, URL base);
//   - `resolveProviderAuth` → chave/token e destino, para uso interno das rotas.
//
// Manter as duas com nomes distintos é proposital: um `getCredentials` que
// devolvesse tudo acabaria, mais cedo ou mais tarde, serializado num JSON de
// resposta por descuido.

import { prisma } from "@/lib/prisma";
import { AI_PROVIDERS, isAIProviderId } from "./providers";
import type { AIAuthType, AIProviderId } from "./types";
import { canStoreSecrets, decryptSecret, encryptSecret, secretHint } from "./crypto";
import { decodeOAuthCredential, encodeOAuthCredential, refreshGoogleCredential, type OAuthCredential } from "./oauth";
import { OPENAI_CODEX_BASE_URL, refreshOpenAICredential } from "./openai-device-oauth";

/** O que pode ser mostrado na tela. Note que NÃO existe campo com a chave. */
export interface CredentialView {
  provider: AIProviderId;
  hint: string;
  baseUrl: string | null;
  updatedAt: Date;
  /** A chave está guardada mas o servidor não consegue mais lê-la. */
  broken: boolean;
  authType?: AIAuthType;
}

export type AgentAuthType = Extract<AIAuthType, "codex" | "claude-code">;
const AGENT_CREDENTIAL_PREFIX = "drr-ai-agent-v1:";

export function encodeAgentCredential(authType: AgentAuthType): string {
  return `${AGENT_CREDENTIAL_PREFIX}${authType}`;
}

export function decodeAgentCredential(value: string): AgentAuthType | null {
  if (!value.startsWith(AGENT_CREDENTIAL_PREFIX)) return null;
  const type = value.slice(AGENT_CREDENTIAL_PREFIX.length);
  if (type === "codex" || type === "claude-code") return type;
  throw new Error("Conexão de agente inválida. Reconecte sua conta.");
}

export { canStoreSecrets };

/** Credenciais do usuário, sem os segredos. */
export async function listCredentials(userId: number): Promise<CredentialView[]> {
  const rows = await prisma.aICredential.findMany({
    where: { userId },
    orderBy: { provider: "asc" },
  });

  return rows.filter((r) => isAIProviderId(r.provider)).map((r) => {
    let oauth: OAuthCredential | null = null;
    let agent: AgentAuthType | null = null;
    const plaintext = decryptSecret(r.keyCipher);
    let broken = plaintext === null;
    try {
      agent = plaintext ? decodeAgentCredential(plaintext) : null;
      oauth = plaintext && !agent ? decodeOAuthCredential(plaintext) : null;
      if (oauth && oauth.provider !== r.provider) broken = true;
    } catch {
      broken = true;
    }
    return {
      provider: r.provider as AIProviderId,
      hint: r.keyHint,
      baseUrl: r.baseUrl,
      updatedAt: r.updatedAt,
      broken,
      authType: agent || (oauth ? "oauth" as const : "api-key" as const),
    };
  });
}

export async function saveOAuthCredential(userId: number, credential: OAuthCredential): Promise<void> {
  const provider = credential.provider;
  const data = {
    keyCipher: encryptSecret(encodeOAuthCredential(credential)),
    keyHint: secretHint(credential.accessToken),
    baseUrl: provider === "openai" ? OPENAI_CODEX_BASE_URL : AI_PROVIDERS[provider].defaultBaseUrl || null,
  };
  await prisma.aICredential.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, ...data }, update: data,
  });
}

export interface ProviderAuth {
  apiKey?: string;
  baseUrl?: string;
  authType?: AIAuthType;
  quotaProject?: string;
  accountId?: string;
  agentUserId?: number;
}

export async function saveAgentCredential(
  userId: number,
  provider: "openai" | "anthropic",
  authType: AgentAuthType,
): Promise<void> {
  if ((provider === "openai" && authType !== "codex") ||
      (provider === "anthropic" && authType !== "claude-code")) {
    throw new Error("Agente incompatível com o provedor.");
  }
  const data = {
    keyCipher: encryptSecret(encodeAgentCredential(authType)),
    keyHint: authType === "codex" ? "Codex" : "Claude Code",
    baseUrl: null,
  };
  await prisma.aICredential.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, ...data },
    update: data,
  });
}

/**
 * Lê chave/token e destino juntos para não mandar OAuth a um proxy.
 * Precedência: credencial pessoal, depois chave corporativa do ambiente.
 * Rascunhos são aceitos somente nas rotas de teste e listagem de modelos.
 */
export async function resolveProviderAuth(userId: number, provider: AIProviderId, draftKey?: string, draftUrl?: string): Promise<ProviderAuth> {
  if (draftKey?.trim()) return { apiKey: draftKey.trim(), baseUrl: draftUrl?.trim() || undefined, authType: "api-key" };
  const row = await prisma.aICredential.findUnique({ where: { userId_provider: { userId, provider } } });
  const plaintext = row ? decryptSecret(row.keyCipher) : null;
  const agent = plaintext ? decodeAgentCredential(plaintext) : null;
  if (agent) return { authType: agent, agentUserId: userId };
  let credential = plaintext ? decodeOAuthCredential(plaintext) : null;
  if (!credential) return { apiKey: plaintext || envApiKey(provider), baseUrl: draftUrl?.trim() || row?.baseUrl || undefined, authType: "api-key" };
  if (credential.provider !== provider) throw new Error("Credencial inválida. Reconecte sua conta.");
  if ((credential.provider === "gemini" || credential.provider === "openai") && (credential.expiresAt || 0) <= Date.now() + 60_000) {
    credential = credential.provider === "gemini"
      ? await refreshGoogleCredential(credential)
      : await refreshOpenAICredential(credential);
    // Compare-and-swap: refresh nunca recria uma conexão removida nem sobrescreve uma chave nova.
    const updated = await prisma.aICredential.updateMany({
      where: { userId, provider, keyCipher: row!.keyCipher },
      data: { keyCipher: encryptSecret(encodeOAuthCredential(credential)), keyHint: secretHint(credential.accessToken) },
    });
    if (!updated.count) throw new Error("A conexão mudou durante a renovação. Tente novamente.");
  }
  return {
    apiKey: credential.accessToken,
    baseUrl: credential.provider === "openai" ? OPENAI_CODEX_BASE_URL : AI_PROVIDERS[provider].defaultBaseUrl,
    authType: "oauth",
    quotaProject: credential.quotaProject,
    accountId: credential.accountId,
  };
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

/** Chave da empresa, do .env do servidor. */
export function envApiKey(provider: AIProviderId): string | undefined {
  const envVar = AI_PROVIDERS[provider]?.keyEnvVar;
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  if (fromEnv) return fromEnv;

  // Único alias que não é derivável do keyEnvVar do provedor.
  if (provider === "gemini") return process.env.GOOGLE_API_KEY?.trim() || undefined;

  return undefined;
}
