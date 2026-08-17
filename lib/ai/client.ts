import { AI_PROVIDERS } from "./providers";
import { getEffectiveApiKey, getEffectiveBaseUrl } from "./settings";
import { AICompletionOptions, AICompletionResult, AIMessage, AIProviderId } from "./types";

/**
 * Motor universal de execução para todos os provedores de IA.
 * Utiliza chamadas HTTP nativas (fetch) sem dependências externas pesadas.
 */
export async function executeAICompletion(
  options: AICompletionOptions
): Promise<AICompletionResult> {
  const provider: AIProviderId = options.provider || "gemini";
  const providerConfig = AI_PROVIDERS[provider];
  const model = options.model || providerConfig?.defaultModel || "default";
  const apiKey = getEffectiveApiKey(provider, options.apiKey);
  const baseUrl = getEffectiveBaseUrl(provider, options.baseUrl);

  if (providerConfig?.requiresApiKey && !apiKey) {
    throw new Error(
      `Chave de API não configurada para o provedor ${providerConfig.name}. ` +
      `Configure a variável de ambiente ${providerConfig.keyEnvVar} ou insira sua chave em Configurações > Inteligência Artificial.`
    );
  }

  const startTime = Date.now();

  try {
    switch (provider) {
      case "anthropic":
        return await callAnthropic(options, model, apiKey!, baseUrl, startTime);
      case "gemini":
        return await callGemini(options, model, apiKey!, startTime);
      case "cohere":
        return await callCohere(options, model, apiKey!, baseUrl, startTime);
      case "openai":
      case "deepseek":
      case "groq":
      case "mistral":
      case "xai":
      case "openrouter":
      case "ollama":
      case "custom":
      default:
        return await callOpenAICompatible(options, provider, model, apiKey || "", baseUrl, startTime);
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[AI Error][${provider}/${model}] after ${elapsed}ms:`, error);
    throw new Error(
      error?.message || `Erro ao comunicar com o provedor ${providerConfig?.name || provider}`
    );
  }
}

// ----------------------------------------------------------------------------
// Anthropic Claude Driver
// ----------------------------------------------------------------------------
async function callAnthropic(
  options: AICompletionOptions,
  model: string,
  apiKey: string,
  baseUrl: string,
  startTime: number
): Promise<AICompletionResult> {
  const formattedMessages = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const systemPrompt =
    options.systemPrompt ||
    options.messages.find((m) => m.role === "system")?.content;

  const url = `${baseUrl.replace(/\/+$/, "")}/v1/messages`;

  const payload: any = {
    model,
    max_tokens: options.maxTokens || 4096,
    messages: formattedMessages,
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  if (options.temperature !== undefined && !model.includes("thought")) {
    payload.temperature = options.temperature;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Anthropic API retornou status ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const textContent = (data.content || [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n\n");

  return {
    text: textContent || "",
    provider: "anthropic",
    model: data.model || model,
    latencyMs: Date.now() - startTime,
    usage: {
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

// ----------------------------------------------------------------------------
// Google Gemini Driver
// ----------------------------------------------------------------------------
async function callGemini(
  options: AICompletionOptions,
  model: string,
  apiKey: string,
  startTime: number
): Promise<AICompletionResult> {
  const contents = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemText =
    options.systemPrompt ||
    options.messages.find((m) => m.role === "system")?.content;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  };

  if (systemText) {
    payload.systemInstruction = {
      parts: [{ text: systemText }],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Google Gemini API retornou status ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";

  return {
    text,
    provider: "gemini",
    model,
    latencyMs: Date.now() - startTime,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount,
      completionTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount,
    },
  };
}

// ----------------------------------------------------------------------------
// Cohere Driver
// ----------------------------------------------------------------------------
async function callCohere(
  options: AICompletionOptions,
  model: string,
  apiKey: string,
  baseUrl: string,
  startTime: number
): Promise<AICompletionResult> {
  const systemPrompt =
    options.systemPrompt ||
    options.messages.find((m) => m.role === "system")?.content;

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  for (const m of options.messages) {
    if (m.role !== "system") {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/chat`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cohere API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.message?.content?.[0]?.text || data.text || "";

  return {
    text,
    provider: "cohere",
    model,
    latencyMs: Date.now() - startTime,
    usage: {
      promptTokens: data.usage?.tokens?.input_tokens,
      completionTokens: data.usage?.tokens?.output_tokens,
      totalTokens:
        (data.usage?.tokens?.input_tokens || 0) +
        (data.usage?.tokens?.output_tokens || 0),
    },
  };
}

// ----------------------------------------------------------------------------
// Universal OpenAI-Compatible Driver (OpenAI, DeepSeek, Groq, Mistral, xAI, OpenRouter, Ollama, Custom)
// ----------------------------------------------------------------------------
async function callOpenAICompatible(
  options: AICompletionOptions,
  provider: AIProviderId,
  model: string,
  apiKey: string,
  baseUrl: string,
  startTime: number
): Promise<AICompletionResult> {
  const messages: AIMessage[] = [];

  const systemText =
    options.systemPrompt ||
    options.messages.find((m) => m.role === "system")?.content;

  if (systemText) {
    messages.push({ role: "system", content: systemText });
  }

  for (const m of options.messages) {
    if (m.role !== "system") {
      messages.push({ role: m.role, content: m.content });
    }
  }

  let endpoint = baseUrl.replace(/\/+$/, "");
  if (!endpoint.endsWith("/chat/completions")) {
    if (!endpoint.endsWith("/v1")) {
      endpoint = `${endpoint}/v1/chat/completions`;
    } else {
      endpoint = `${endpoint}/chat/completions`;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://drrprojetos.com.br";
    headers["X-Title"] = "DRR ERP CRM";
  }

  const isReasoningModel =
    model.startsWith("o1") ||
    model.startsWith("o3-mini") ||
    model.includes("reasoner");

  const payload: any = {
    model,
    messages,
  };

  if (!isReasoningModel) {
    payload.temperature = options.temperature ?? 0.5;
    if (options.maxTokens) payload.max_tokens = options.maxTokens;
  } else {
    if (options.maxTokens) payload.max_completion_tokens = options.maxTokens;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `${provider.toUpperCase()} API retornou status ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg = parsed.error.message;
      else if (parsed.message) msg = parsed.message;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";

  return {
    text,
    provider,
    model: data.model || model,
    latencyMs: Date.now() - startTime,
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    },
  };
}
