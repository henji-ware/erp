"use client";

import { useCallback, useEffect, useState } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import {
  AI_SETTINGS_COOKIE,
  AI_SETTINGS_STORAGE_KEY,
  getDefaultAISettings,
  parseAISettings,
} from "@/lib/ai/settings";
import { AIProviderId, AISettingsData } from "@/lib/ai/types";

/** Disparado ao salvar, para as telas abertas na mesma aba se atualizarem. */
const CHANGE_EVENT = "drr-ai-settings-changed";

function read(): AISettingsData {
  if (typeof window === "undefined") return getDefaultAISettings();
  try {
    return parseAISettings(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) || undefined);
  } catch {
    return getDefaultAISettings();
  }
}

/**
 * Grava o cookie apenas com o que não é segredo. O cookie existe só para o
 * servidor renderizar a tela de Configurações já com o provedor certo; as
 * chaves ficam de fora de propósito, porque cookie viaja em toda requisição e
 * é legível por qualquer script da página.
 */
function writePublicCookie(settings: AISettingsData) {
  const { apiKeys, ...publicSettings } = settings;
  const value = encodeURIComponent(JSON.stringify(publicSettings));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AI_SETTINGS_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

export function saveAISettings(next: AISettingsData) {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    writePublicCookie(next);
  } catch {
    // localStorage indisponível (aba anônima, cota cheia): segue em memória.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Configuração de IA compartilhada pelo Copilot, pelo assistente de propostas e
 * pela tela de Configurações. Antes cada um lia o localStorage no mount e nunca
 * mais — trocar o modelo nas Configurações não chegava no Copilot já aberto.
 */
export function useAISettings() {
  // Começa no padrão para o HTML do servidor bater com o do cliente; o valor
  // real do localStorage entra logo depois, no efeito.
  const [settings, setSettings] = useState<AISettingsData>(getDefaultAISettings());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const current = read();
    setSettings(current);
    setLoaded(true);

    // Versões anteriores gravavam as chaves de API dentro do cookie. Reescreve
    // o cookie sem elas assim que a tela abre, em vez de esperar o usuário
    // mexer em alguma configuração.
    if (document.cookie.includes(`${AI_SETTINGS_COOKIE}=`)) {
      try {
        writePublicCookie(current);
      } catch {
        // cookie bloqueado: nada a fazer
      }
    }

    const sync = () => setSettings(read());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync); // outras abas
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((next: AISettingsData) => {
    setSettings(next);
    saveAISettings(next);
  }, []);

  return { settings, setSettings: update, loaded };
}

/** Provedor, modelo e chave que uma chamada de IA deve usar agora. */
export function activeCredentials(settings: AISettingsData, override?: {
  provider?: AIProviderId;
  model?: string;
}) {
  const provider = override?.provider || settings.activeProvider;
  const config = AI_PROVIDERS[provider];
  return {
    provider,
    model: override?.model || settings.defaultModels[provider] || config?.defaultModel || "",
    apiKey: settings.apiKeys[provider] || "",
    baseUrl: settings.customBaseUrls[provider] || "",
  };
}
