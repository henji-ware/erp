import { AI_PROVIDERS, DEFAULT_AI_PROVIDER } from "./providers";
import { AIProviderId, AISettingsData } from "./types";

export const AI_SETTINGS_COOKIE = "drr_ai_settings";

export function getDefaultAISettings(): AISettingsData {
  const defaultModels: Partial<Record<AIProviderId, string>> = {};
  for (const [id, config] of Object.entries(AI_PROVIDERS)) {
    defaultModels[id as AIProviderId] = config.defaultModel;
  }

  return {
    activeProvider: DEFAULT_AI_PROVIDER,
    defaultModels,
    apiKeys: {},
    customBaseUrls: {},
    customModels: {},
  };
}

export function parseAISettings(rawJson?: string): AISettingsData {
  const defaults = getDefaultAISettings();
  if (!rawJson) return defaults;

  try {
    const parsed = JSON.parse(rawJson);
    return {
      activeProvider: parsed.activeProvider || defaults.activeProvider,
      defaultModels: { ...defaults.defaultModels, ...(parsed.defaultModels || {}) },
      apiKeys: { ...(parsed.apiKeys || {}) },
      customBaseUrls: { ...(parsed.customBaseUrls || {}) },
      customModels: { ...(parsed.customModels || {}) },
    };
  } catch {
    return defaults;
  }
}

/**
 * Obtém a chave de API efetiva para um determinado provedor:
 * 1. Chave configurada na sessão/cookie do usuário
 * 2. Chave definida no ambiente (.env)
 */
export function getEffectiveApiKey(
  providerId: AIProviderId,
  userApiKey?: string
): string | undefined {
  if (userApiKey && userApiKey.trim().length > 0) {
    return userApiKey.trim();
  }

  const envVar = AI_PROVIDERS[providerId]?.keyEnvVar;
  if (envVar && process.env[envVar]) {
    return process.env[envVar]?.trim();
  }

  // Fallbacks comuns
  if (providerId === "openai" && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  if (providerId === "anthropic" && process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  if (providerId === "gemini" && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
    return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim();
  }
  if (providerId === "groq" && process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY.trim();
  if (providerId === "deepseek" && process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim();
  if (providerId === "mistral" && process.env.MISTRAL_API_KEY) return process.env.MISTRAL_API_KEY.trim();
  if (providerId === "xai" && process.env.XAI_API_KEY) return process.env.XAI_API_KEY.trim();
  if (providerId === "cohere" && process.env.COHERE_API_KEY) return process.env.COHERE_API_KEY.trim();
  if (providerId === "openrouter" && process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();

  return undefined;
}

export function getEffectiveBaseUrl(
  providerId: AIProviderId,
  userBaseUrl?: string
): string {
  if (userBaseUrl && userBaseUrl.trim().length > 0) {
    return userBaseUrl.trim().replace(/\/+$/, "");
  }

  if (providerId === "ollama" && process.env.OLLAMA_BASE_URL) {
    return process.env.OLLAMA_BASE_URL.trim().replace(/\/+$/, "");
  }

  return AI_PROVIDERS[providerId]?.defaultBaseUrl || "https://api.openai.com";
}
