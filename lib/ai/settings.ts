import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, isAIProviderId } from "./providers";
import { AIProviderId, AISettingsData } from "./types";

/**
 * Cookie com as preferências de IA — provedor ativo, modelo padrão e URLs base.
 * NÃO guarda chaves de API: cookie é enviado em toda requisição e é legível por
 * qualquer script da página. As chaves ficam só no localStorage do navegador e
 * são enviadas apenas no corpo das chamadas para /api/ai/*.
 */
export const AI_SETTINGS_COOKIE = "drr_ai_settings";

/** Chave do localStorage (preferências + chaves de API). */
export const AI_SETTINGS_STORAGE_KEY = "drr_ai_settings";

export function getDefaultAISettings(): AISettingsData {
  // defaultModels começa VAZIO de propósito. Pré-preencher com o catálogo do
  // código fazia todo provedor parecer configurado e "inventava" um modelo
  // (ex.: OpenRouter aparecia com anthropic/claude-sonnet-4.5 sem chave
  // nenhuma). Modelo só existe depois de vir da API do usuário.
  return {
    activeProvider: DEFAULT_AI_PROVIDER,
    defaultModels: {},
    apiKeys: {},
    customBaseUrls: {},
    customModels: {},
  };
}

function asStringMap(value: unknown): Partial<Record<AIProviderId, string>> {
  const out: Partial<Record<AIProviderId, string>> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isAIProviderId(k) && typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

/**
 * Lê o JSON salvo (cookie ou localStorage) de forma defensiva: dados de origem
 * não confiável, podendo estar corrompidos, antigos ou com provedores que não
 * existem mais. Qualquer campo inválido volta ao padrão em vez de derrubar a
 * página de configurações.
 */
export function parseAISettings(rawJson?: string): AISettingsData {
  const defaults = getDefaultAISettings();
  if (!rawJson) return defaults;

  // O cookie é gravado com encodeURIComponent no navegador. Dependendo da
  // versão do Next, cookies().get() pode devolver o valor ainda codificado.
  let raw = rawJson;
  if (raw.startsWith("%7B")) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return defaults;
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== "object") return defaults;

  const customModels: Partial<Record<AIProviderId, string[]>> = {};
  if (parsed.customModels && typeof parsed.customModels === "object") {
    for (const [k, v] of Object.entries(parsed.customModels as Record<string, unknown>)) {
      if (isAIProviderId(k) && Array.isArray(v)) {
        customModels[k] = v.filter((m): m is string => typeof m === "string");
      }
    }
  }

  return {
    activeProvider: isAIProviderId(parsed.activeProvider)
      ? parsed.activeProvider
      : defaults.activeProvider,
    defaultModels: asStringMap(parsed.defaultModels),
    apiKeys: asStringMap(parsed.apiKeys),
    customBaseUrls: asStringMap(parsed.customBaseUrls),
    customModels,
  };
}

/**
 * Chave de API efetiva:
 * 1. A que o usuário digitou nas Configurações (fica no navegador dele);
 * 2. A variável de ambiente do servidor (.env), quando existir.
 */
export function getEffectiveApiKey(
  providerId: AIProviderId,
  userApiKey?: string
): string | undefined {
  if (userApiKey && userApiKey.trim().length > 0) {
    return userApiKey.trim();
  }

  const envVar = AI_PROVIDERS[providerId]?.keyEnvVar;
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  if (fromEnv) return fromEnv;

  // Único alias que não é derivável do keyEnvVar do provedor.
  if (providerId === "gemini") return process.env.GOOGLE_API_KEY?.trim() || undefined;

  return undefined;
}

export function getEffectiveBaseUrl(providerId: AIProviderId, userBaseUrl?: string): string {
  if (userBaseUrl && userBaseUrl.trim().length > 0) {
    return userBaseUrl.trim().replace(/\/+$/, "");
  }

  if (providerId === "ollama" && process.env.OLLAMA_BASE_URL) {
    return process.env.OLLAMA_BASE_URL.trim().replace(/\/+$/, "");
  }

  return AI_PROVIDERS[providerId]?.defaultBaseUrl || "https://api.openai.com";
}

const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|.*\.local)$|^\[?(fc|fd)/i;

/**
 * A URL base vem do navegador e é buscada pelo servidor — sem validação isso é
 * um SSRF que enxerga a rede interna da VPS. Provedores locais (Ollama, LM
 * Studio) são a exceção declarada em `allowsPrivateHost`.
 */
export function assertSafeBaseUrl(providerId: AIProviderId, baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`URL base inválida para ${AI_PROVIDERS[providerId]?.name || providerId}.`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("A URL base precisa usar http:// ou https://.");
  }

  if (AI_PROVIDERS[providerId]?.allowsPrivateHost) return;

  if (PRIVATE_HOST.test(url.hostname)) {
    throw new Error(
      `Endereços de rede interna não são permitidos para ${AI_PROVIDERS[providerId]?.name || providerId}. ` +
        "Use os provedores Ollama ou Custom para servidores locais."
    );
  }
}
