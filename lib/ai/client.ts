import { AI_PROVIDERS } from "./providers";
import { assertSafeBaseUrl, getEffectiveApiKey, getEffectiveBaseUrl } from "./settings";
import { AICompletionOptions, AICompletionResult, AIMessage, AIProviderId } from "./types";

/**
 * Motor universal de execução para todos os provedores de IA.
 * Utiliza chamadas HTTP nativas (fetch) sem dependências externas pesadas.
 */

/** Nenhuma chamada de IA deve segurar uma rota do Next indefinidamente. */
const REQUEST_TIMEOUT_MS = 120_000;

export interface ResolvedCall {
  provider: AIProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  systemPrompt?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens: number;
}

/**
 * Valida e normaliza tudo que veio do navegador antes de qualquer fetch:
 * provedor conhecido, chave presente, URL base não apontando para a rede
 * interna e histórico de mensagens saneado.
 */
export function resolveCall(options: AICompletionOptions): ResolvedCall {
  const provider: AIProviderId = options.provider && AI_PROVIDERS[options.provider]
    ? options.provider
    : "gemini";
  const providerConfig = AI_PROVIDERS[provider];
  const model = (options.model || providerConfig.defaultModel || "default").trim();
  const apiKey = getEffectiveApiKey(provider, options.apiKey);
  const baseUrl = getEffectiveBaseUrl(provider, options.baseUrl);

  assertSafeBaseUrl(provider, baseUrl);

  if (providerConfig.requiresApiKey && !apiKey) {
    throw new Error(
      `Chave de API não configurada para ${providerConfig.name}. ` +
        `Defina ${providerConfig.keyEnvVar} no servidor ou informe a chave em Configurações > Inteligência Artificial.`
    );
  }

  const systemPrompt =
    options.systemPrompt || options.messages.find((m) => m.role === "system")?.content;

  const messages = normalizeHistory(options.messages);
  if (messages.length === 0) {
    throw new Error("Nenhuma mensagem para enviar ao modelo.");
  }

  return {
    provider,
    model,
    apiKey: apiKey || "",
    baseUrl,
    systemPrompt,
    messages,
    temperature: providerConfig.supportsTemperature === false ? undefined : options.temperature,
    maxTokens: options.maxTokens ?? 4096,
  };
}

/**
 * Anthropic e Gemini exigem que a conversa comece com o usuário e alterne os
 * papéis; mandar duas mensagens seguidas do mesmo papel devolve HTTP 400.
 * Aqui as consecutivas viram uma só e um "assistant" inicial é descartado —
 * é a mensagem de boas-vindas fixa do Copilot, que não é histórico real.
 */
function normalizeHistory(all: AIMessage[]): AIMessage[] {
  const out: AIMessage[] = [];
  for (const m of all) {
    if (m.role === "system") continue;
    const content = (m.content || "").trim();
    if (!content) continue;
    if (out.length === 0 && m.role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role: m.role, content });
    }
  }
  return out;
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/** Extrai a mensagem de erro real do provedor em vez de devolver "status 400". */
async function readError(res: Response, providerName: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  let detail = "";
  try {
    const parsed = JSON.parse(body);
    detail =
      parsed?.error?.message ||
      parsed?.error?.metadata?.raw ||
      parsed?.message ||
      (typeof parsed?.error === "string" ? parsed.error : "");
  } catch {
    detail = body.slice(0, 300);
  }

  if (res.status === 401 || res.status === 403) {
    return new Error(`${providerName}: chave de API inválida ou sem permissão. ${detail}`.trim());
  }
  if (res.status === 404) {
    return new Error(
      `${providerName}: modelo não encontrado. Verifique o identificador em Configurações > Inteligência Artificial. ${detail}`.trim()
    );
  }
  if (res.status === 429) {
    return new Error(`${providerName}: limite de uso atingido, tente novamente em instantes.`);
  }
  return new Error(detail || `${providerName} retornou status ${res.status}.`);
}

export async function executeAICompletion(
  options: AICompletionOptions & { signal?: AbortSignal }
): Promise<AICompletionResult> {
  const call = resolveCall(options);
  const startTime = Date.now();
  const { signal, done } = withTimeout(options.signal);

  try {
    switch (call.provider) {
      case "anthropic":
        return await callAnthropic(call, signal, startTime);
      case "gemini":
        return await callGemini(call, signal, startTime);
      case "cohere":
        return await callCohere(call, signal, startTime);
      default:
        return await callOpenAICompatible(call, signal, startTime);
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    if (error?.name === "AbortError") {
      throw new Error(
        `O provedor ${AI_PROVIDERS[call.provider].name} não respondeu a tempo (${Math.round(elapsed / 1000)}s).`
      );
    }
    console.error(`[AI Error][${call.provider}/${call.model}] após ${elapsed}ms:`, error?.message);
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    done();
  }
}

// ----------------------------------------------------------------------------
// Anthropic Claude Driver
// ----------------------------------------------------------------------------
function anthropicPayload(call: ResolvedCall, stream: boolean) {
  const payload: Record<string, unknown> = {
    model: call.model,
    max_tokens: call.maxTokens,
    messages: call.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (call.systemPrompt) payload.system = call.systemPrompt;
  // `temperature` foi removido da geração atual do Claude e devolve 400.
  // AI_PROVIDERS.anthropic.supportsTemperature = false já zera isso em resolveCall.
  if (call.temperature !== undefined) payload.temperature = call.temperature;
  if (stream) payload.stream = true;
  return payload;
}

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
}

async function callAnthropic(
  call: ResolvedCall,
  signal: AbortSignal,
  startTime: number
): Promise<AICompletionResult> {
  const url = `${call.baseUrl.replace(/\/+$/, "")}/v1/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: anthropicHeaders(call.apiKey),
    body: JSON.stringify(anthropicPayload(call, false)),
    signal,
  });

  if (!res.ok) throw await readError(res, "Anthropic");

  const data = await res.json();
  const textContent = (data.content || [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n\n");

  return {
    text: textContent || "",
    provider: "anthropic",
    model: data.model || call.model,
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
function geminiPayload(call: ResolvedCall) {
  const payload: Record<string, unknown> = {
    contents: call.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: call.temperature ?? 0.4,
      maxOutputTokens: call.maxTokens,
    },
  };
  if (call.systemPrompt) {
    payload.systemInstruction = { parts: [{ text: call.systemPrompt }] };
  }
  return payload;
}

function geminiUrl(call: ResolvedCall, stream: boolean): string {
  const method = stream ? "streamGenerateContent" : "generateContent";
  const base = (call.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const sse = stream ? "&alt=sse" : "";
  return `${base}/v1beta/models/${encodeURIComponent(call.model)}:${method}?key=${encodeURIComponent(call.apiKey)}${sse}`;
}

async function callGemini(
  call: ResolvedCall,
  signal: AbortSignal,
  startTime: number
): Promise<AICompletionResult> {
  const res = await fetch(geminiUrl(call, false), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiPayload(call)),
    signal,
  });

  if (!res.ok) throw await readError(res, "Google Gemini");

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";

  if (!text && data.candidates?.[0]?.finishReason === "SAFETY") {
    throw new Error("O Gemini bloqueou a resposta por filtro de segurança. Reformule a pergunta.");
  }

  return {
    text,
    provider: "gemini",
    model: call.model,
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
  call: ResolvedCall,
  signal: AbortSignal,
  startTime: number
): Promise<AICompletionResult> {
  const messages: any[] = [];
  if (call.systemPrompt) messages.push({ role: "system", content: call.systemPrompt });
  for (const m of call.messages) messages.push({ role: m.role, content: m.content });

  const res = await fetch(`${call.baseUrl.replace(/\/+$/, "")}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${call.apiKey}`,
    },
    body: JSON.stringify({
      model: call.model,
      messages,
      temperature: call.temperature ?? 0.3,
      max_tokens: call.maxTokens,
    }),
    signal,
  });

  if (!res.ok) throw await readError(res, "Cohere");

  const data = await res.json();
  const text =
    (data.message?.content || [])
      .map((c: any) => c?.text || "")
      .join("") || data.text || "";

  return {
    text,
    provider: "cohere",
    model: call.model,
    latencyMs: Date.now() - startTime,
    usage: {
      promptTokens: data.usage?.tokens?.input_tokens,
      completionTokens: data.usage?.tokens?.output_tokens,
      totalTokens:
        (data.usage?.tokens?.input_tokens || 0) + (data.usage?.tokens?.output_tokens || 0),
    },
  };
}

// ----------------------------------------------------------------------------
// Driver universal OpenAI-compatible
// (OpenAI, DeepSeek, Groq, Mistral, xAI, OpenRouter, Ollama, Custom)
// ----------------------------------------------------------------------------
function openAIEndpoint(baseUrl: string): string {
  let endpoint = baseUrl.replace(/\/+$/, "");
  if (endpoint.endsWith("/chat/completions")) return endpoint;
  if (endpoint.endsWith("/v1")) return `${endpoint}/chat/completions`;
  return `${endpoint}/v1/chat/completions`;
}

function openAIHeaders(call: ResolvedCall): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (call.apiKey) headers["Authorization"] = `Bearer ${call.apiKey}`;
  if (call.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://drrprojetos.com.br";
    headers["X-Title"] = "DRR ERP CRM";
  }
  return headers;
}

/** o1/o3 e os "reasoner" recusam temperature e usam max_completion_tokens. */
function isReasoningModel(model: string): boolean {
  return /^o\d/.test(model) || model.includes("reasoner") || model.includes("-r1");
}

function openAIPayload(call: ResolvedCall, stream: boolean) {
  const messages: AIMessage[] = [];
  if (call.systemPrompt) messages.push({ role: "system", content: call.systemPrompt });
  messages.push(...call.messages);

  const payload: Record<string, unknown> = { model: call.model, messages };

  if (isReasoningModel(call.model)) {
    payload.max_completion_tokens = call.maxTokens;
  } else {
    payload.temperature = call.temperature ?? 0.5;
    payload.max_tokens = call.maxTokens;
  }
  if (stream) {
    payload.stream = true;
    payload.stream_options = { include_usage: true };
  }
  return payload;
}

async function callOpenAICompatible(
  call: ResolvedCall,
  signal: AbortSignal,
  startTime: number
): Promise<AICompletionResult> {
  const res = await fetch(openAIEndpoint(call.baseUrl), {
    method: "POST",
    headers: openAIHeaders(call),
    body: JSON.stringify(openAIPayload(call, false)),
    signal,
  });

  if (!res.ok) throw await readError(res, AI_PROVIDERS[call.provider].name);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";

  return {
    text,
    provider: call.provider,
    model: data.model || call.model,
    latencyMs: Date.now() - startTime,
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    },
  };
}

// ----------------------------------------------------------------------------
// Streaming — o Copilot mostra a resposta saindo em vez de um spinner longo
// ----------------------------------------------------------------------------

async function* readSSE(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + (buffer[sep] === "\r" ? 4 : 2));
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
  }
}

/**
 * Emite pedaços de texto conforme chegam. Provedores sem streaming implementado
 * caem no modo normal e emitem a resposta inteira de uma vez — quem consome não
 * precisa saber a diferença.
 */
export async function* streamAICompletion(
  options: AICompletionOptions & { signal?: AbortSignal }
): AsyncGenerator<string, AICompletionResult> {
  const call = resolveCall(options);
  const startTime = Date.now();
  const { signal, done } = withTimeout(options.signal);
  let full = "";

  try {
    if (call.provider === "cohere") {
      const result = await callCohere(call, signal, startTime);
      if (result.text) yield result.text;
      return result;
    }

    let res: Response;
    if (call.provider === "anthropic") {
      res = await fetch(`${call.baseUrl.replace(/\/+$/, "")}/v1/messages`, {
        method: "POST",
        headers: anthropicHeaders(call.apiKey),
        body: JSON.stringify(anthropicPayload(call, true)),
        signal,
      });
    } else if (call.provider === "gemini") {
      res = await fetch(geminiUrl(call, true), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload(call)),
        signal,
      });
    } else {
      res = await fetch(openAIEndpoint(call.baseUrl), {
        method: "POST",
        headers: openAIHeaders(call),
        body: JSON.stringify(openAIPayload(call, true)),
        signal,
      });
    }

    if (!res.ok) throw await readError(res, AI_PROVIDERS[call.provider].name);

    for await (const raw of readSSE(res)) {
      if (!raw || raw === "[DONE]") continue;
      let evt: any;
      try {
        evt = JSON.parse(raw);
      } catch {
        continue;
      }

      let piece = "";
      if (call.provider === "anthropic") {
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          piece = evt.delta.text || "";
        } else if (evt.type === "error") {
          throw new Error(evt.error?.message || "Erro no stream da Anthropic.");
        }
      } else if (call.provider === "gemini") {
        piece =
          evt.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
      } else {
        piece = evt.choices?.[0]?.delta?.content || "";
      }

      if (piece) {
        full += piece;
        yield piece;
      }
    }

    return {
      text: full,
      provider: call.provider,
      model: call.model,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      // Cancelamento do usuário ou timeout: devolve o que já saiu.
      return { text: full, provider: call.provider, model: call.model, latencyMs: Date.now() - startTime };
    }
    console.error(`[AI Stream Error][${call.provider}/${call.model}]:`, error?.message);
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    done();
  }
}
