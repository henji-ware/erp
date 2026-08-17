"use client";

import { useState, useEffect, useRef } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIMessage, AIProviderId } from "@/lib/ai/types";
import { getDefaultAISettings } from "@/lib/ai/settings";

interface ChatEntry extends AIMessage {
  latencyMs?: number;
  modelUsed?: string;
  providerUsed?: string;
}

export default function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o Copilot de IA da **DRR Projetos e Equipamentos**.\n\nPosso te ajudar com resumos de vendas, contas a pagar/receber, normas técnicas (NR12, ABNT NBR 15524), inspeções pendentes ou redigir mensagens comerciais para clientes.\n\nComo posso te ajudar hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Carrega configurações de IA salvas
  useEffect(() => {
    try {
      const local = localStorage.getItem("drr_ai_settings");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.activeProvider) {
          setSelectedProvider(parsed.activeProvider);
          const model =
            parsed.defaultModels?.[parsed.activeProvider] ||
            AI_PROVIDERS[parsed.activeProvider as AIProviderId]?.defaultModel;
          if (model) setSelectedModel(model);
          if (parsed.apiKeys?.[parsed.activeProvider]) {
            setApiKey(parsed.apiKeys[parsed.activeProvider]);
          }
        }
      }
    } catch {}
  }, []);

  // Escuta evento customizado para abrir com prompt vindo do Command Palette ou botões
  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e.detail?.prompt) {
        setInput(e.detail.prompt);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener("open-drr-copilot", handleOpen);
    return () => window.removeEventListener("open-drr-copilot", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleProviderChange = (newProv: AIProviderId) => {
    setSelectedProvider(newProv);
    const defModel = AI_PROVIDERS[newProv]?.defaultModel || "default";
    setSelectedModel(defModel);
    try {
      const local = localStorage.getItem("drr_ai_settings");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.apiKeys?.[newProv]) {
          setApiKey(parsed.apiKeys[newProv]);
        } else {
          setApiKey("");
        }
      }
    } catch {}
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: ChatEntry = { role: "user", content: textToSend };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          provider: selectedProvider,
          model: selectedModel,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erro ao consultar o Copilot.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text,
          latencyMs: data.latencyMs,
          modelUsed: data.model,
          providerUsed: data.provider,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Erro:** ${err.message}\n\n*Dica: Você pode verificar suas chaves em Configurações > Inteligência Artificial ou trocar de modelo no menu acima.*`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickPrompts = [
    { label: "📊 Resumo executivo de hoje", text: "Faça um resumo executivo da situação atual da DRR hoje (leads em aberto, contas vencidas e inspeções)." },
    { label: "⚠️ Contas vencidas", text: "Quais contas a receber e a pagar estão vencidas e quais exigem atenção imediata?" },
    { label: "🔍 Inspeções próximas", text: "Quais são as inspeções técnicas agendadas para os próximos dias?" },
    { label: "✉️ Rascunho de cobrança WhatsApp", text: "Gere um modelo de mensagem cordial de cobrança no WhatsApp para cliente com fatura vencida há poucos dias." },
    { label: "💡 Oportunidades do funil", text: "Analise os leads em aberto e sugira ações comerciais para acelerar o fechamento." },
  ];

  return (
    <>
      {/* Botão Flutuante Gatilho */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-brand-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-indigo-400/30 group"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping group-hover:animate-none" />
          <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
            <span>✨</span> Copilot IA
          </span>
          <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
            {selectedModel.split("-").slice(0, 2).join("-")}
          </span>
        </button>
      )}

      {/* Janela de Chat Flutuante */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[95vw] sm:w-[460px] md:w-[500px] h-[620px] max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-fade-in-up">
          {/* Header do Copilot */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 text-sm">
                ✨
              </span>
              <div>
                <h3 className="text-xs font-bold leading-tight">Copilot de IA · DRR</h3>
                <p className="text-[10px] text-slate-400">Inteligência conectada ao ERP</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMessages([messages[0]])}
                title="Limpar conversa"
                className="p-1 rounded text-slate-400 hover:text-white text-xs"
              >
                🗑️
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white text-base leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Seletor Rápido de Provedor e Modelo */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Modelo:
            </span>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-300 dark:border-slate-700 outline-none"
            >
              {Object.values(AI_PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-mono rounded-lg px-2 py-1 border border-slate-300 dark:border-slate-700 outline-none truncate"
            >
              {AI_PROVIDERS[selectedProvider]?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                      isUser
                        ? "bg-brand-600 text-white rounded-br-xs shadow-md"
                        : "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/60"
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* Metadata da Resposta */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                      {m.latencyMs && (
                        <span>
                          ⚡ {m.latencyMs}ms · {m.modelUsed || selectedModel}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(m.content, idx)}
                        className="hover:text-slate-600 dark:hover:text-slate-200 underline font-medium"
                      >
                        {copiedIndex === idx ? "✓ Copiado!" : "Copiar"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-xs w-fit">
                <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                <span>Processando com {selectedModel}...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pills de Perguntas Rápidas */}
          <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 no-scrollbar">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(p.text)}
                disabled={loading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Campo de Input */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Digite sua dúvida sobre o ERP ou peça para redigir..."
              className="flex-1 resize-none rounded-xl p-2.5 text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="h-10 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center transition-colors shadow-sm"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
