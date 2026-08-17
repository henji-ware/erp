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
  /**
   * Só existe no navegador (localStorage). Nunca é gravado em cookie: cookie
   * viaja em toda requisição e é legível por qualquer script da página.
   */
  apiKeys: Partial<Record<AIProviderId, string>>;
  customBaseUrls: Partial<Record<AIProviderId, string>>;
  customModels: Partial<Record<AIProviderId, string[]>>;
}

/** O subconjunto não sensível que pode ser persistido em cookie para o SSR. */
export type AIPublicSettings = Omit<AISettingsData, "apiKeys">;
