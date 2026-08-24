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
import { saveApiKey } from "@/app/settings/ai-key-actions";

/** Disparado ao salvar, para as telas abertas na mesma aba se atualizarem. */
const CHANGE_EVENT = "drr-ai-settings-changed";

/**
 * Conta logada, publicada pelo layout no <body>. As PREFERÊNCIAS de IA
 * (provedor, modelo, URL base) continuam separadas por conta aqui: num
 * computador compartilhado, sem isso o próximo a entrar herdaria a
 * configuração de quem usou antes.
 *
 * A chave de API já não passa por este arquivo — ela vive cifrada no banco
 * (lib/ai/credentials.ts). O que resta aqui é a migração de quem ainda tem
 * uma chave guardada de versões anteriores.
 */
function scope(): string {
  if (typeof document === "undefined") return "anon";
  return document.body?.dataset?.userId || "anon";
}

function storageKey(): string {
  return `${AI_SETTINGS_STORAGE_KEY}:${scope()}`;
}

function cookieName(): string {
  return `${AI_SETTINGS_COOKIE}_${scope()}`;
}

function read(): AISettingsData {
  if (typeof window === "undefined") return getDefaultAISettings();
  try {
    return parseAISettings(localStorage.getItem(storageKey()) || undefined);
  } catch {
    return getDefaultAISettings();
  }
}

/**
 * Grava o cookie das preferências. Hoje `AISettingsData` já não carrega
 * segredo nenhum — as chaves vivem cifradas no banco —, então não há mais o
 * que separar antes de escrever.
 */
function writePublicCookie(settings: AISettingsData) {
  const value = encodeURIComponent(JSON.stringify(settings));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${cookieName()}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

/**
 * Migra a chave que ficou no localStorage de antes desta versão.
 *
 * Manda para o servidor (onde é cifrada) e apaga do navegador. Sem isto, quem
 * já usava o sistema teria a chave apagada do localStorage e precisaria
 * cadastrá-la de novo sem entender por quê — e uma cópia em claro ficaria
 * para trás em cada navegador usado até hoje.
 */
function migrarChavesAntigas() {
  for (const key of [storageKey(), AI_SETTINGS_STORAGE_KEY]) {
    const raw = localStorage.getItem(key);
    if (!raw || !raw.includes("apiKeys")) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const chaves = parsed.apiKeys;
    delete parsed.apiKeys;
    // Apaga PRIMEIRO: se o envio falhar, o segredo já saiu do navegador e o
    // usuário cadastra de novo. O inverso deixaria a cópia em claro para trás.
    localStorage.setItem(key, JSON.stringify(parsed));

    if (chaves && typeof chaves === "object") {
      for (const [provider, value] of Object.entries(chaves as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) {
          void saveApiKey(provider, value).catch(() => {
            // Sem sessão ou sem segredo no servidor: o usuário recadastra.
          });
        }
      }
    }
  }
}

export function saveAISettings(next: AISettingsData) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next));
    writePublicCookie(next);
  } catch {
    // localStorage indisponível (aba anônima, cota cheia): segue em memória.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Configuração de IA compartilhada pelo DeskHelper AI, pelo assistente de propostas e
 * pela tela de Configurações. Antes cada um lia o localStorage no mount e nunca
 * mais — trocar o modelo nas Configurações não chegava no DeskHelper AI já aberto.
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

    // Versões anteriores usavam uma chave/cookie globais — e guardavam a chave
    // de API dentro do cookie. Move para o espaço da conta e apaga o antigo,
    // para não sobrar configuração compartilhada entre usuários da máquina.
    try {
      migrarChavesAntigas();
      const legacy = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (legacy) {
        if (!localStorage.getItem(storageKey())) localStorage.setItem(storageKey(), legacy);
        localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
        setSettings(read());
      }
      if (document.cookie.includes(`${AI_SETTINGS_COOKIE}=`)) {
        document.cookie = `${AI_SETTINGS_COOKIE}=; path=/; max-age=0`;
      }
      writePublicCookie(current);
    } catch {
      // armazenamento bloqueado: nada a fazer
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

/**
 * Modelos que podem ser oferecidos ao usuário: só os que vieram da API dele.
 * O catálogo do código não entra aqui de propósito — provedores aposentam
 * modelos sem aviso, e oferecer um ID morto só gera erro 404 na hora de usar.
 */
export function availableModels(settings: AISettingsData, provider: AIProviderId): string[] {
  return settings.customModels[provider] ?? [];
}

/** Provedor e modelo que uma chamada de IA deve usar agora. */
export function activeCredentials(
  settings: AISettingsData,
  override?: { provider?: AIProviderId; model?: string }
) {
  const provider = override?.provider || settings.activeProvider;
  return {
    provider,
    // Sem fallback para o catálogo do código: um modelo que a conta não tem
    // só produz 404. Vazio aqui significa "ainda não configurado".
    model: override?.model || settings.defaultModels[provider] || "",
    // Sem apiKey aqui de propósito: quem resolve a chave é o servidor, a
    // partir do que está cifrado no banco. O navegador não precisa dela para
    // nada e passá-la adiante só recriaria o caminho que foi fechado.
    baseUrl: settings.customBaseUrls[provider] || "",
  };
}

/**
 * Provedores que dá para usar de verdade: os que já tiveram a lista de modelos
 * carregada da API do usuário. Antes o seletor mostrava os onze, mesmo sem
 * chave, e escolher um deles trazia um modelo inventado do catálogo.
 */
export function configuredProviders(settings: AISettingsData): AIProviderId[] {
  return (Object.keys(AI_PROVIDERS) as AIProviderId[]).filter(
    (id) => (settings.customModels[id]?.length ?? 0) > 0
  );
}
