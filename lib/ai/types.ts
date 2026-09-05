export type AIProviderId =
  | "anthropic"
  | "gemini"
  | "openai"
  | "deepseek"
  | "groq"
  | "mistral"
  | "xai"
  | "cohere"
  | "openrouter"
  | "ollama"
  | "custom";

export type AIModelTier = "flagship" | "fast" | "reasoning" | "specialized";

export interface AIModelInfo {
  id: string;
  name: string;
  description?: string;
  tier?: AIModelTier;
  contextWindow?: string;
  isNew?: boolean;
}

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  tagline: string;
  description: string;
  badgeColor: string;
  keyEnvVar: string;
  defaultBaseUrl?: string;
  requiresApiKey: boolean;
  defaultModel: string;
  models: AIModelInfo[];
  /**
   * Alguns provedores rejeitam `temperature` com HTTP 400 (a geração atual da
   * Anthropic, por exemplo). Quando false, o parâmetro nunca é enviado.
   */
  supportsTemperature?: boolean;
  /**
   * Libera endereços de rede interna na URL base. Só vale para provedores
   * locais (Ollama, LM Studio); nos demais isso seria um vetor de SSRF.
   */
  allowsPrivateHost?: boolean;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  provider?: AIProviderId;
  model?: string;
  apiKey?: string;
  /** Resolvido exclusivamente no servidor, nunca aceito do corpo HTTP. */
  authType?: "api-key" | "oauth";
  quotaProject?: string;
  baseUrl?: string;
  messages: AIMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ajusta as mensagens de erro: só administrador recebe dica sobre o .env. */
  isAdmin?: boolean;
}

export interface AICompletionResult {
  text: string;
  provider: AIProviderId;
  model: string;
  latencyMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AICompletionOptionsWithStream extends AICompletionOptions {
  signal?: AbortSignal;
}

export interface AISettingsData {
  activeProvider: AIProviderId;
  defaultModels: Partial<Record<AIProviderId, string>>;
  // As chaves NÃO ficam mais aqui. Elas vivem cifradas no banco, por usuário
  // (ver lib/ai/credentials.ts): antes moravam no localStorage, sumiam ao
  // trocar de máquina, eram legíveis por qualquer script da página e viajavam
  // no corpo de toda chamada de IA. O navegador hoje só conhece a dica dos
  // quatro últimos caracteres.
  customBaseUrls: Partial<Record<AIProviderId, string>>;
  customModels: Partial<Record<AIProviderId, string[]>>;
}

/** O subconjunto não sensível que pode ser persistido em cookie para o SSR. */
/** Mantido como alias: hoje AISettingsData já não tem segredo algum. */
export type AIPublicSettings = AISettingsData;
