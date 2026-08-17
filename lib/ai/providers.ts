import { AIProviderConfig, AIProviderId } from "./types";

/**
 * Catálogo de provedores e modelos.
 *
 * IMPORTANTE: os IDs abaixo são os identificadores reais aceitos por cada API.
 * Um ID inventado não dá erro de compilação — só falha em produção com 404 no
 * momento da chamada. Ao adicionar um modelo, confira na documentação oficial
 * do provedor antes. O botão "Carregar modelos da minha conta" nas
 * Configurações busca a lista viva direto da API e é a fonte definitiva.
 */
export const AI_PROVIDERS: Record<AIProviderId, AIProviderConfig> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    tagline: "Raciocínio avançado e redação técnica refinada",
    description:
      "Modelos líderes em escrita comercial, análise profunda e formulação de escopos técnicos detalhados.",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    keyEnvVar: "ANTHROPIC_API_KEY",
    defaultBaseUrl: "https://api.anthropic.com",
    requiresApiKey: true,
    defaultModel: "claude-sonnet-5",
    supportsTemperature: false,
    models: [
      {
        id: "claude-opus-5",
        name: "Claude Opus 5",
        description: "Máxima capacidade para análise crítica e síntese executiva profunda.",
        tier: "reasoning",
        contextWindow: "1M",
        isNew: true,
      },
      {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        description: "Melhor equilíbrio entre velocidade e inteligência. Padrão recomendado.",
        tier: "flagship",
        contextWindow: "1M",
        isNew: true,
      },
      {
        id: "claude-opus-4-8",
        name: "Claude Opus 4.8",
        description: "Geração anterior do Opus, excelente em trabalho autônomo longo.",
        tier: "reasoning",
        contextWindow: "1M",
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        description: "Geração anterior do Sonnet, ótima relação custo/qualidade.",
        tier: "flagship",
        contextWindow: "1M",
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "Ultra rápido e econômico para tarefas rotineiras e classificação.",
        tier: "fast",
        contextWindow: "200k",
      },
    ],
  },

  gemini: {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Janela de contexto massiva e velocidade de ponta",
    description:
      "Modelos multimodais de alta velocidade e capacidade de processar grandes históricos de dados.",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    keyEnvVar: "GEMINI_API_KEY",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    requiresApiKey: true,
    defaultModel: "gemini-2.0-flash",
    supportsTemperature: true,
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Geração de texto em tempo real com boa precisão multimodal.",
        tier: "flagship",
        contextWindow: "1M",
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        description: "Modelo econômico e rápido para consultas frequentes.",
        tier: "fast",
        contextWindow: "1M",
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Janela de 2M tokens para análise de relatórios extensos e auditorias.",
        tier: "reasoning",
        contextWindow: "2M",
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Rápido e balanceado para automações e respostas instantâneas.",
        tier: "fast",
        contextWindow: "1M",
      },
    ],
  },

  openai: {
    id: "openai",
    name: "OpenAI",
    tagline: "Modelos pioneiros em inteligência geral e raciocínio",
    description: "A família GPT e os modelos o-series para lógica e planejamento complexo.",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    keyEnvVar: "OPENAI_API_KEY",
    defaultBaseUrl: "https://api.openai.com",
    requiresApiKey: true,
    defaultModel: "gpt-4o",
    supportsTemperature: true,
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o (Omni)",
        description: "Inteligência de ponta para todas as tarefas com alta velocidade.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Opção rápida e econômica para respostas imediatas.",
        tier: "fast",
        contextWindow: "128k",
      },
      {
        id: "o3-mini",
        name: "o3-mini (Raciocínio Rápido)",
        description: "Especializado em raciocínio lógico, cálculo e normas técnicas.",
        tier: "reasoning",
        contextWindow: "200k",
      },
      {
        id: "o1",
        name: "o1 (Raciocínio Profundo)",
        description: "Raciocínio detalhado antes de responder problemas difíceis.",
        tier: "reasoning",
        contextWindow: "200k",
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Conhecimento consolidado e alta confiabilidade.",
        tier: "flagship",
        contextWindow: "128k",
      },
    ],
  },

  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    tagline: "Raciocínio avançado e altíssimo custo-benefício",
    description:
      "Modelos abertos de ponta com boa capacidade de raciocínio lógico e estruturação de dados.",
    badgeColor: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    keyEnvVar: "DEEPSEEK_API_KEY",
    defaultBaseUrl: "https://api.deepseek.com",
    requiresApiKey: true,
    defaultModel: "deepseek-chat",
    supportsTemperature: true,
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3 (Chat)",
        description: "Modelo geral de alta inteligência e respostas muito rápidas.",
        tier: "flagship",
        contextWindow: "64k",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1 (Reasoner)",
        description: "Raciocínio profundo com cadeia de pensamentos detalhada.",
        tier: "reasoning",
        contextWindow: "64k",
      },
    ],
  },

  groq: {
    id: "groq",
    name: "Groq (Ultra-Rápido)",
    tagline: "Inferência em milissegundos via chips LPU",
    description:
      "Velocidade impressionante para respostas sem atraso perceptível no chat e nas buscas.",
    badgeColor: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    keyEnvVar: "GROQ_API_KEY",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    defaultModel: "llama-3.3-70b-versatile",
    supportsTemperature: true,
    models: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile",
        description: "O modelo aberto mais forte da Meta com velocidade extrema.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "deepseek-r1-distill-llama-70b",
        name: "DeepSeek R1 Distill Llama 70B",
        description: "Raciocínio estilo DeepSeek R1 rodando na velocidade Groq.",
        tier: "reasoning",
        contextWindow: "128k",
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant",
        description: "Geração ultrarrápida para respostas instantâneas.",
        tier: "fast",
        contextWindow: "128k",
      },
    ],
  },

  mistral: {
    id: "mistral",
    name: "Mistral AI",
    tagline: "Modelos europeus de alta precisão e versatilidade",
    description:
      "Bom desempenho em múltiplos idiomas, elaboração de documentos e lógica de negócios.",
    badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    keyEnvVar: "MISTRAL_API_KEY",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    defaultModel: "mistral-large-latest",
    supportsTemperature: true,
    models: [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        description: "Topo de linha da Mistral para raciocínio complexo e redação.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        description: "Rápido, econômico e eficiente para respostas diárias.",
        tier: "fast",
        contextWindow: "32k",
      },
      {
        id: "codestral-latest",
        name: "Codestral",
        description: "Especialista em lógica, estruturas de dados e consultas técnicas.",
        tier: "specialized",
        contextWindow: "32k",
      },
      {
        id: "pixtral-large-latest",
        name: "Pixtral Large",
        description: "Multimodal para análise de documentos e imagens.",
        tier: "flagship",
        contextWindow: "128k",
      },
    ],
  },

  xai: {
    id: "xai",
    name: "xAI (Grok)",
    tagline: "Inteligência analítica moderna e direta",
    description: "Modelos Grok desenvolvidos pela equipe da xAI.",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    keyEnvVar: "XAI_API_KEY",
    defaultBaseUrl: "https://api.x.ai/v1",
    requiresApiKey: true,
    defaultModel: "grok-2-latest",
    supportsTemperature: true,
    models: [
      {
        id: "grok-2-latest",
        name: "Grok 2",
        description: "Modelo de ponta com boa precisão e raciocínio analítico.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "grok-2-vision-1212",
        name: "Grok 2 Vision",
        description: "Leitura de relatórios visuais e gráficos.",
        tier: "flagship",
        contextWindow: "32k",
      },
    ],
  },

  cohere: {
    id: "cohere",
    name: "Cohere",
    tagline: "Especialista em dados corporativos e RAG",
    description: "Foco em sumarização de dados empresariais, busca e respostas precisas.",
    badgeColor: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    keyEnvVar: "COHERE_API_KEY",
    defaultBaseUrl: "https://api.cohere.com/v2",
    requiresApiKey: true,
    defaultModel: "command-r-plus-08-2024",
    supportsTemperature: true,
    models: [
      {
        id: "command-r-plus-08-2024",
        name: "Command R+ (08-2024)",
        description: "Modelo corporativo premium para análise e geração de relatórios.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "command-r-08-2024",
        name: "Command R",
        description: "Equilíbrio entre custo e desempenho para empresas.",
        tier: "fast",
        contextWindow: "128k",
      },
    ],
  },

  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Acesso unificado a centenas de modelos com 1 única chave",
    description:
      "Permite usar modelos de vários fornecedores (Claude, GPT, Llama, DeepSeek) centralizando cobrança e limites.",
    badgeColor: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    keyEnvVar: "OPENROUTER_API_KEY",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    defaultModel: "anthropic/claude-sonnet-4.5",
    supportsTemperature: true,
    models: [
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet 4.5 (via OpenRouter)",
        description: "Acesso ao Claude sem precisar de conta na Anthropic.",
        tier: "flagship",
        contextWindow: "200k",
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o (via OpenRouter)",
        description: "Modelo oficial da OpenAI.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1 (via OpenRouter)",
        description: "Raciocínio avançado aberto.",
        tier: "reasoning",
        contextWindow: "128k",
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        description: "Modelo aberto de alta inteligência.",
        tier: "flagship",
        contextWindow: "128k",
      },
      {
        id: "google/gemini-2.0-flash-001",
        name: "Gemini 2.0 Flash (via OpenRouter)",
        description: "Google Gemini 2.0 Flash.",
        tier: "fast",
        contextWindow: "1M",
      },
    ],
  },

  ollama: {
    id: "ollama",
    name: "Ollama (IA Local & Offline)",
    tagline: "Privacidade total rodando na sua própria máquina",
    description:
      "Sem custos de API e 100% privado. Roda modelos locais através do Ollama em http://localhost:11434.",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    keyEnvVar: "OLLAMA_BASE_URL",
    defaultBaseUrl: "http://localhost:11434",
    requiresApiKey: false,
    allowsPrivateHost: true,
    defaultModel: "llama3.3",
    supportsTemperature: true,
    models: [
      {
        id: "llama3.3",
        name: "Llama 3.3 (Local)",
        description: "Modelo local completo da Meta.",
        tier: "flagship",
      },
      {
        id: "deepseek-r1",
        name: "DeepSeek R1 (Local)",
        description: "Raciocínio profundo local (distill ou full).",
        tier: "reasoning",
      },
      {
        id: "qwen2.5",
        name: "Qwen 2.5 (Local)",
        description: "Bom em código, tabelas e raciocínio técnico.",
        tier: "flagship",
      },
      {
        id: "mistral",
        name: "Mistral 7B (Local)",
        description: "Leve e rápido para qualquer máquina com CPU/GPU.",
        tier: "fast",
      },
    ],
  },

  custom: {
    id: "custom",
    name: "Custom / OpenAI-Compatible",
    tagline: "Conecte qualquer servidor compatível (LM Studio, vLLM, Azure)",
    description:
      "Permite especificar qualquer URL base (ex: LM Studio, vLLM, Together AI, Fireworks) e nome de modelo personalizado.",
    badgeColor: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    keyEnvVar: "CUSTOM_AI_API_KEY",
    defaultBaseUrl: "http://localhost:1234/v1",
    requiresApiKey: false,
    allowsPrivateHost: true,
    defaultModel: "default-model",
    supportsTemperature: true,
    models: [
      {
        id: "default-model",
        name: "Modelo Customizado Padrão",
        description: "O modelo configurado no seu servidor customizado.",
        tier: "flagship",
      },
    ],
  },
};

export const DEFAULT_AI_PROVIDER: AIProviderId = "gemini";

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AIProviderId[];

export function isAIProviderId(value: unknown): value is AIProviderId {
  return typeof value === "string" && value in AI_PROVIDERS;
}
