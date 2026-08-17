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
  modelsEndpoint?: string;
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

export interface AISettingsData {
  activeProvider: AIProviderId;
  defaultModels: Partial<Record<AIProviderId, string>>;
  apiKeys: Partial<Record<AIProviderId, string>>;
  customBaseUrls: Partial<Record<AIProviderId, string>>;
  customModels: Partial<Record<AIProviderId, string[]>>;
}
