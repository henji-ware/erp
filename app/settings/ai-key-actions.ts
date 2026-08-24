"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { isAIProviderId } from "@/lib/ai/providers";
import {
  saveCredential,
  deleteCredential,
  canStoreSecrets,
} from "@/lib/ai/credentials";
import { logAudit } from "@/lib/audit";

export type KeyActionResult = { ok: true; hint: string } | { ok: false; error: string };

/**
 * Guarda a chave de API do provedor para a conta logada.
 *
 * A chave chega aqui uma única vez — no envio do formulário — e sai cifrada
 * para o banco. A resposta devolve só os quatro últimos caracteres: nada que
 * volte para o navegador permite reconstruir a chave.
 *
 * O userId vem SEMPRE da sessão, nunca do formulário. Aceitá-lo do cliente
 * deixaria qualquer usuário gravar (ou sobrescrever) a chave de outro.
 */
export async function saveApiKey(
  provider: string,
  apiKey: string,
  baseUrl?: string,
): Promise<KeyActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!isAIProviderId(provider)) return { ok: false, error: "Provedor desconhecido." };

  const key = (apiKey ?? "").trim();
  if (!key) return { ok: false, error: "Informe a chave." };
  if (key.length > 500) return { ok: false, error: "Chave longa demais." };

  if (!canStoreSecrets()) {
    return {
      ok: false,
      error:
        "O servidor não tem segredo de criptografia configurado (AI_ENCRYPTION_KEY). Sem ele a chave só pode ser guardada em claro, o que não fazemos.",
    };
  }

  try {
    const { hint } = await saveCredential(user.id, provider, key, baseUrl);
    // O resumo não cita a chave nem a dica: o log de auditoria é lido por
    // administradores, e registrar pedaço de segredo ali seria mais uma
    // cópia para vazar.
    await logAudit({
      action: "UPDATE",
      entity: "Chave de IA",
      summary: `Chave do provedor ${provider} cadastrada`,
    });
    revalidatePath("/settings");
    return { ok: true, hint };
  } catch (error) {
    console.error("[saveApiKey]", error);
    return { ok: false, error: "Não foi possível guardar a chave." };
  }
}

export async function removeApiKey(provider: string): Promise<KeyActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!isAIProviderId(provider)) return { ok: false, error: "Provedor desconhecido." };

  await deleteCredential(user.id, provider);
  await logAudit({
    action: "DELETE",
    entity: "Chave de IA",
    summary: `Chave do provedor ${provider} removida`,
  });
  revalidatePath("/settings");
  return { ok: true, hint: "" };
}
