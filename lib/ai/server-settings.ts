import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { AI_SETTINGS_COOKIE, parseAISettings } from "./settings";
import { AISettingsData } from "./types";

/**
 * Preferências de IA da conta logada, para a tela de Configurações já sair do
 * servidor com o provedor certo.
 *
 * O cookie é separado por usuário (`drr_ai_settings_<id>`): num computador
 * compartilhado, um cookie único faria a configuração de um vazar para o
 * próximo que entrasse. Chaves de API nunca estão aqui — só no navegador.
 */
export async function getServerAISettings(): Promise<AISettingsData> {
  const [store, user] = await Promise.all([cookies(), getCurrentUser()]);
  const name = `${AI_SETTINGS_COOKIE}_${user ? user.id : "anon"}`;
  return parseAISettings(store.get(name)?.value);
}
