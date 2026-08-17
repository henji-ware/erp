import { AIProviderConfig, AIProviderId } from "./types";

/**
 * Catálogo de provedores e modelos.
 *
 * IMPORTANTE: os IDs abaixo são os identificadores reais aceitos por cada API.
 * Um ID inventado não dá erro de compilação — só falha em produção com 404 no
 * momento da chamada. Ao adicionar um modelo, confira na documentação oficial
 * do provedor antes.
 *
 * Esta lista é um ponto de partida e envelhece: os fornecedores lançam e
 * aposentam modelos o tempo todo. A fonte definitiva é o botão
 * "Carregar modelos da minha conta" nas Configurações, que consulta a API do
 * provedor com a sua chave e devolve exatamente o que ela aceita hoje.
 */
export const AI_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    tagline: "Raciocínio avançado e redação técnica refinada",
    description:
      "Modelos líderes em escrita comercial, análise profunda e formulação de escopos técnicos detalhados.",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/25",
    keyEnvVar: "ANTHROPIC_API_KEY",
    defaultBaseUrl: "https://api.anthropic.com",
    requiresApiKey: true,
    defaultModel: "claude-sonnet-5",
    supportsTemperature: false,
    models: [
      { id: "claude-opus-5", name: "Claude Opus 5", description: "Máxima capacidade para análise crítica e trabalho longo.", tier: "reasoning", contextWindow: "1M", isNew: true },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", description: "Melhor equilíbrio entre velocidade e inteligência. Recomendado.", tier: "flagship", contextWindow: "1M", isNew: true },
      { id: "claude-fable-5", name: "Claude Fable 5", description: "O mais capaz da Anthropic, para os casos mais exigentes.", tier: "reasoning", contextWindow: "1M", isNew: true },
      { id: "claude-opus-4-8", name: "Claude Opus 4.8", description: "Geração anterior do Opus, forte em trabalho autônomo.", tier: "reasoning", contextWindow: "1M" },
      { id: "claude-opus-4-7", name: "Claude Opus 4.7", description: "Opus 4.7, boa relação capacidade/custo.", tier: "reasoning", contextWindow: "1M" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Opus 4.6.", tier: "reasoning", contextWindow: "1M" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Geração anterior do Sonnet.", tier: "flagship", contextWindow: "1M" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Sonnet 4.5.", tier: "flagship", contextWindow: "200k" },
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", description: "Opus 4.5.", tier: "reasoning", contextWindow: "200k" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Rápido e econômico para tarefas rotineiras.", tier: "fast", contextWindow: "200k" },
    ],
  },

  gemini: {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Janela de contexto massiva e velocidade de ponta",
    description:
      "Modelos multimodais de alta velocidade e capacidade de processar grandes históricos de dados.",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/25",
    keyEnvVar: "GEMINI_API_KEY",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    requiresApiKey: true,
    defaultModel: "gemini-2.5-flash",
    supportsTemperature: true,
    // O Google aposenta versões rápido: a família 2.0 e a 1.5 já saíram do ar
    // e devolvem "no longer available". A lista viva da conta é quem manda.
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Alta capacidade de raciocínio.", tier: "reasoning", contextWindow: "1M" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Rápido e capaz, bom padrão do dia a dia.", tier: "flagship", contextWindow: "1M" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Versão mais econômica do 2.5 Flash.", tier: "fast", contextWindow: "1M" },
    ],
  },

  openai: {
    id: "openai",
    name: "OpenAI",
    tagline: "Modelos pioneiros em inteligência geral e raciocínio",
    description: "A família GPT e os modelos o-series para lógica e planejamento complexo.",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
    keyEnvVar: "OPENAI_API_KEY",
    defaultBaseUrl: "https://api.openai.com",
    requiresApiKey: true,
    defaultModel: "gpt-4o",
    supportsTemperature: true,
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", description: "Geração 4.1, forte em instruções longas e código.", tier: "flagship", contextWindow: "1M", isNew: true },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Equilíbrio entre custo e capacidade.", tier: "fast", contextWindow: "1M", isNew: true },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "O mais rápido e barato da família 4.1.", tier: "fast", contextWindow: "1M", isNew: true },
      { id: "gpt-4o", name: "GPT-4o (Omni)", description: "Multimodal de uso geral com alta velocidade.", tier: "flagship", contextWindow: "128k" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Opção rápida e econômica para respostas imediatas.", tier: "fast", contextWindow: "128k" },
      { id: "o3", name: "o3 (Raciocínio)", description: "Raciocínio profundo para problemas difíceis.", tier: "reasoning", contextWindow: "200k", isNew: true },
      { id: "o4-mini", name: "o4-mini", description: "Raciocínio rápido e econômico.", tier: "reasoning", contextWindow: "200k", isNew: true },
      { id: "o3-mini", name: "o3-mini", description: "Lógica, cálculo e normas técnicas com baixo custo.", tier: "reasoning", contextWindow: "200k" },
      { id: "o1", name: "o1", description: "Raciocínio detalhado antes de responder.", tier: "reasoning", contextWindow: "200k" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Conhecimento consolidado e alta confiabilidade.", tier: "flagship", contextWindow: "128k" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Legado, bem barato para tarefas simples.", tier: "fast", contextWindow: "16k" },
    ],
  },

  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    tagline: "Raciocínio avançado e altíssimo custo-benefício",
    description:
      "Modelos abertos de ponta com boa capacidade de raciocínio lógico e estruturação de dados.",
    badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/25",
    keyEnvVar: "DEEPSEEK_API_KEY",
    defaultBaseUrl: "https://api.deepseek.com",
    requiresApiKey: true,
    defaultModel: "deepseek-chat",
    supportsTemperature: true,
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat", description: "Modelo geral de alta inteligência e resposta rápida.", tier: "flagship", contextWindow: "64k" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner", description: "Raciocínio profundo com cadeia de pensamento.", tier: "reasoning", contextWindow: "64k" },
    ],
  },

  groq: {
    id: "groq",
    name: "Groq (Ultra-Rápido)",
    tagline: "Inferência em milissegundos via chips LPU",
    description:
      "Velocidade impressionante para respostas sem atraso perceptível no chat e nas buscas.",
    badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/25",
    keyEnvVar: "GROQ_API_KEY",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    defaultModel: "llama-3.3-70b-versatile",
    supportsTemperature: true,
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", description: "Modelo aberto forte da Meta com velocidade extrema.", tier: "flagship", contextWindow: "128k" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", description: "Geração ultrarrápida para respostas instantâneas.", tier: "fast", contextWindow: "128k" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", description: "Raciocínio estilo R1 na velocidade Groq.", tier: "reasoning", contextWindow: "128k" },
      { id: "llama3-70b-8192", name: "Llama 3 70B", description: "Geração anterior, ainda muito capaz.", tier: "flagship", contextWindow: "8k" },
      { id: "llama3-8b-8192", name: "Llama 3 8B", description: "Leve e barato.", tier: "fast", contextWindow: "8k" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Modelo aberto do Google, rápido.", tier: "fast", contextWindow: "8k" },
    ],
  },

  mistral: {
    id: "mistral",
    name: "Mistral AI",
    tagline: "Modelos europeus de alta precisão e versatilidade",
    description:
      "Bom desempenho em múltiplos idiomas, elaboração de documentos e lógica de negócios.",
    badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/25",
    keyEnvVar: "MISTRAL_API_KEY",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    defaultModel: "mistral-large-latest",
    supportsTemperature: true,
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", description: "Topo de linha para raciocínio complexo e redação.", tier: "flagship", contextWindow: "128k" },
      { id: "mistral-medium-latest", name: "Mistral Medium", description: "Equilíbrio entre custo e capacidade.", tier: "flagship", contextWindow: "128k" },
      { id: "mistral-small-latest", name: "Mistral Small", description: "Rápido e econômico para respostas diárias.", tier: "fast", contextWindow: "32k" },
      { id: "ministral-8b-latest", name: "Ministral 8B", description: "Compacto, bom custo por token.", tier: "fast", contextWindow: "128k" },
      { id: "ministral-3b-latest", name: "Ministral 3B", description: "O mais leve da linha.", tier: "fast", contextWindow: "128k" },
      { id: "codestral-latest", name: "Codestral", description: "Especialista em lógica, dados e consultas técnicas.", tier: "specialized", contextWindow: "32k" },
      { id: "pixtral-large-latest", name: "Pixtral Large", description: "Multimodal para documentos e imagens.", tier: "flagship", contextWindow: "128k" },
      { id: "open-mistral-nemo", name: "Mistral Nemo", description: "Modelo aberto multilíngue.", tier: "fast", contextWindow: "128k" },
    ],
  },

  xai: {
    id: "xai",
    name: "xAI (Grok)",
    tagline: "Inteligência analítica moderna e direta",
    description: "Modelos Grok desenvolvidos pela equipe da xAI.",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/25",
    keyEnvVar: "XAI_API_KEY",
    defaultBaseUrl: "https://api.x.ai/v1",
    requiresApiKey: true,
    defaultModel: "grok-3",
    supportsTemperature: true,
    models: [
      { id: "grok-4", name: "Grok 4", description: "Geração mais recente da xAI.", tier: "reasoning", contextWindow: "256k", isNew: true },
      { id: "grok-3", name: "Grok 3", description: "Modelo de ponta com bom raciocínio analítico.", tier: "flagship", contextWindow: "131k", isNew: true },
      { id: "grok-3-mini", name: "Grok 3 Mini", description: "Versão leve e econômica do Grok 3.", tier: "fast", contextWindow: "131k", isNew: true },
      { id: "grok-2-latest", name: "Grok 2", description: "Geração anterior.", tier: "flagship", contextWindow: "128k" },
      { id: "grok-2-vision-1212", name: "Grok 2 Vision", description: "Leitura de relatórios visuais e gráficos.", tier: "flagship", contextWindow: "32k" },
    ],
  },

  cohere: {
    id: "cohere",
    name: "Cohere",
    tagline: "Especialista em dados corporativos e RAG",
    description: "Foco em sumarização de dados empresariais, busca e respostas precisas.",
    badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/25",
    keyEnvVar: "COHERE_API_KEY",
    defaultBaseUrl: "https://api.cohere.com/v2",
    requiresApiKey: true,
    defaultModel: "command-r-plus-08-2024",
    supportsTemperature: true,
    models: [
      { id: "command-a-03-2025", name: "Command A", description: "Modelo mais recente da Cohere para uso corporativo.", tier: "flagship", contextWindow: "256k", isNew: true },
      { id: "command-r-plus-08-2024", name: "Command R+", description: "Premium para análise e geração de relatórios.", tier: "flagship", contextWindow: "128k" },
      { id: "command-r-08-2024", name: "Command R", description: "Equilíbrio entre custo e desempenho.", tier: "fast", contextWindow: "128k" },
      { id: "command-r7b-12-2024", name: "Command R7B", description: "Compacto e barato.", tier: "fast", contextWindow: "128k" },
    ],
  },

  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Acesso unificado a centenas de modelos com 1 única chave",
    description:
      "Permite usar modelos de vários fornecedores (Claude, GPT, Llama, DeepSeek) centralizando cobrança e limites.",
    badgeColor: "bg-violet-500/10 text-violet-600 border-violet-500/25",
    keyEnvVar: "OPENROUTER_API_KEY",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    defaultModel: "anthropic/claude-sonnet-4.5",
    supportsTemperature: true,
    models: [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Claude sem precisar de conta na Anthropic.", tier: "flagship", contextWindow: "200k" },
      { id: "anthropic/claude-opus-4.1", name: "Claude Opus 4.1", description: "Opus via OpenRouter.", tier: "reasoning", contextWindow: "200k" },
      { id: "openai/gpt-4.1", name: "GPT-4.1", description: "GPT-4.1 via OpenRouter.", tier: "flagship", contextWindow: "1M" },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Modelo multimodal da OpenAI.", tier: "flagship", contextWindow: "128k" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Gemini rápido via OpenRouter.", tier: "fast", contextWindow: "1M" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "Raciocínio avançado aberto.", tier: "reasoning", contextWindow: "128k" },
      { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", description: "Uso geral, custo baixo.", tier: "flagship", contextWindow: "64k" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "Modelo aberto de alta inteligência.", tier: "flagship", contextWindow: "128k" },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", description: "Forte em código e tabelas.", tier: "flagship", contextWindow: "128k" },
      { id: "mistralai/mistral-large", name: "Mistral Large", description: "Mistral via OpenRouter.", tier: "flagship", contextWindow: "128k" },
    ],
  },

  ollama: {
    id: "ollama",
    name: "Ollama (IA Local & Offline)",
    tagline: "Privacidade total rodando na sua própria máquina",
    description:
      "Sem custos de API e 100% privado. Roda modelos locais através do Ollama em http://localhost:11434.",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
    keyEnvVar: "OLLAMA_BASE_URL",
    defaultBaseUrl: "http://localhost:11434",
    requiresApiKey: false,
    allowsPrivateHost: true,
    defaultModel: "llama3.3",
    supportsTemperature: true,
    models: [
      { id: "llama3.3", name: "Llama 3.3", description: "Modelo local completo da Meta.", tier: "flagship" },
      { id: "llama3.2", name: "Llama 3.2", description: "Mais leve, roda em máquinas modestas.", tier: "fast" },
      { id: "deepseek-r1", name: "DeepSeek R1", description: "Raciocínio profundo local.", tier: "reasoning" },
      { id: "qwen2.5", name: "Qwen 2.5", description: "Bom em código, tabelas e raciocínio técnico.", tier: "flagship" },
      { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", description: "Especializado em código.", tier: "specialized" },
      { id: "mistral", name: "Mistral 7B", description: "Leve e rápido para qualquer máquina.", tier: "fast" },
      { id: "gemma2", name: "Gemma 2", description: "Modelo aberto do Google.", tier: "fast" },
      { id: "phi4", name: "Phi-4", description: "Compacto da Microsoft, forte em raciocínio.", tier: "fast" },
    ],
  },

  custom: {
    id: "custom",
    name: "Custom / OpenAI-Compatible",
    tagline: "Conecte qualquer servidor compatível (LM Studio, vLLM, Azure)",
    description:
      "Permite especificar qualquer URL base (ex: LM Studio, vLLM, Together AI, Fireworks) e nome de modelo personalizado.",
    badgeColor: "bg-pink-500/10 text-pink-600 border-pink-500/25",
    keyEnvVar: "CUSTOM_AI_API_KEY",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
    allowsPrivateHost: true,
    defaultModel: "default-model",
    supportsTemperature: true,
    models: [
      { id: "default-model", name: "Modelo Customizado", description: "O modelo configurado no seu servidor.", tier: "flagship" },
    ],
  },
};

export const DEFAULT_AI_PROVIDER: AIProviderId = "gemini";

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AIProviderId[];

export function isAIProviderId(value: unknown): value is AIProviderId {
  return typeof value === "string" && value in AI_PROVIDERS;
}
