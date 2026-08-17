"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIMessage, AIProviderId } from "@/lib/ai/types";
import { activeCredentials, useAISettings } from "./useAISettings";
import { RichText } from "./RichText";
import { Icon, type IconName } from "./icons";

interface ChatEntry extends AIMessage {
  latencyMs?: number;
  modelUsed?: string;
  isError?: boolean;
}

const WELCOME: ChatEntry = {
  role: "assistant",
  content:
    "Olá! Sou o Copilot de IA da **DRR Projetos e Equipamentos**.\n\n" +
    "Posso ajudar com resumos de vendas, contas a pagar/receber, normas técnicas (NR12, ABNT NBR 15524), inspeções pendentes ou redigir mensagens comerciais.\n\n" +
    "Como posso ajudar hoje?",
};

const QUICK_PROMPTS: Array<{ icon: IconName; label: string; text: string }> = [
  { icon: "reports", label: "Resumo de hoje", text: "Faça um resumo executivo da situação atual da DRR hoje (leads em aberto, contas vencidas e inspeções)." },
  { icon: "alert", label: "Contas vencidas", text: "Quais contas a receber e a pagar estão vencidas e quais exigem atenção imediata?" },
  { icon: "inspection", label: "Inspeções próximas", text: "Quais são as inspeções técnicas agendadas para os próximos dias?" },
  { icon: "mail", label: "Cobrança WhatsApp", text: "Gere um modelo de mensagem cordial de cobrança no WhatsApp para cliente com fatura vencida há poucos dias." },
  { icon: "bulb", label: "Oportunidades", text: "Analise os leads em aberto e sugira ações comerciais para acelerar o fechamento." },
];

export default function CopilotWidget() {
  const { settings } = useAISettings();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Provedor/modelo do seletor rápido; vazio = usa o padrão das Configurações.
  const [providerOverride, setProviderOverride] = useState<AIProviderId | "">("");
  const [modelOverride, setModelOverride] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const creds = activeCredentials(settings, {
    provider: providerOverride || undefined,
    model: modelOverride || undefined,
  });
  const providerConfig = AI_PROVIDERS[creds.provider];

  // Abre a partir do Command Palette, da sidebar ou do banner do dashboard.
  useEffect(() => {
    const handleOpen = (e: Event) => {
      setIsOpen(true);
      const prompt = (e as CustomEvent).detail?.prompt;
      if (prompt) {
        setInput(prompt);
        setTimeout(() => inputRef.current?.focus(), 120);
      }
    };
    window.addEventListener("open-drr-copilot", handleOpen);
    return () => window.removeEventListener("open-drr-copilot", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText, isOpen]);

  // Escape fecha o painel (menos durante uma geração, para não perder o texto).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, loading]);

  // Cancela a geração em curso se o componente sair da tela.
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend || loading) return;

    const nextMessages: ChatEntry[] = [...messages, { role: "user", content: textToSend }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    let accumulated = "";

    const finish = (entry: Partial<ChatEntry>) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: accumulated, ...entry } as ChatEntry,
      ]);
      setStreamingText("");
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: nextMessages
            .filter((m) => m !== WELCOME)
            .map((m) => ({ role: m.role, content: m.content })),
          provider: creds.provider,
          model: creds.model,
          apiKey: creds.apiKey,
          baseUrl: creds.baseUrl,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `O servidor respondeu ${res.status}.`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let meta: { model?: string; latencyMs?: number } = {};
      let streamError = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const line = buffer.slice(0, sep).trim();
          buffer = buffer.slice(sep + 2);
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "delta") {
              accumulated += evt.text;
              setStreamingText(accumulated);
            } else if (evt.type === "done") {
              meta = { model: evt.model, latencyMs: evt.latencyMs };
            } else if (evt.type === "error") {
              streamError = evt.error;
            }
          } catch {
            // fragmento inválido: ignora e segue o stream
          }
        }
      }

      if (streamError) throw new Error(streamError);

      if (!accumulated.trim()) {
        throw new Error(
          "O modelo retornou uma resposta vazia. Tente outro modelo ou reformule a pergunta."
        );
      }

      finish({
        latencyMs: meta.latencyMs ?? Date.now() - startedAt,
        modelUsed: meta.model || creds.model,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // Interrompido pelo usuário: guarda o trecho que já saiu.
        if (accumulated.trim()) {
          finish({ modelUsed: creds.model, content: `${accumulated}\n\n_(interrompido)_` });
        } else {
          setStreamingText("");
        }
      } else {
        accumulated = "";
        finish({
          isError: true,
          content:
            `**Não consegui responder.**\n\n${err.message}\n\n` +
            "Verifique a chave e o modelo em Configurações > Inteligência Artificial, ou escolha outro provedor no seletor acima.",
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // clipboard bloqueado (http fora de localhost): falha silenciosa
    }
  };

  const shortModel = creds.model.split(/[-/]/).slice(0, 2).join("-") || "IA";

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir o Copilot de IA"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-brand-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-indigo-400/30"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
            <Icon name="ai" size={15} /> Copilot IA
          </span>
          <span className="hidden sm:inline text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full">
            {shortModel}
          </span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Copilot de IA"
          className="fixed bottom-4 right-4 z-50 w-[95vw] sm:w-[460px] md:w-[500px] h-[620px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 text-sm"
                aria-hidden
              >
                <Icon name="ai" size={15} />
              </span>
              <div>
                <h2 className="text-xs font-bold leading-tight">Copilot de IA · DRR</h2>
                <p className="text-[10px] text-slate-400">Conectado aos dados do ERP</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMessages([WELCOME])}
                title="Limpar conversa"
                disabled={loading}
                className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/10 text-xs disabled:opacity-40 transition-colors"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar Copilot"
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          </div>

          {/* Seletor rápido de provedor e modelo */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200 text-xs">
            <span className="text-[11px] font-medium text-slate-500 shrink-0">Modelo:</span>
            <select
              value={creds.provider}
              aria-label="Provedor de IA"
              onChange={(e) => {
                setProviderOverride(e.target.value as AIProviderId);
                setModelOverride("");
              }}
              className="bg-white text-slate-800 text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-300 outline-none focus:border-brand-500 max-w-[40%]"
            >
              {Object.values(AI_PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={creds.model}
              aria-label="Modelo de IA"
              onChange={(e) => setModelOverride(e.target.value)}
              className="flex-1 min-w-0 bg-white text-slate-800 text-[11px] font-mono rounded-lg px-2 py-1 border border-slate-300 outline-none focus:border-brand-500"
            >
              {/* O modelo salvo pode ser um ID digitado à mão, fora do catálogo. */}
              {creds.model && !providerConfig?.models.some((m) => m.id === creds.model) && (
                <option value={creds.model}>{creds.model}</option>
              )}
              {providerConfig?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-slate-50/40">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[88%] px-3.5 py-3 rounded-2xl leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-brand-600 text-white rounded-br-sm"
                        : m.isError
                          ? "bg-red-50 text-red-800 border border-red-200 rounded-bl-sm"
                          : "bg-white text-slate-900 rounded-bl-sm border border-slate-200"
                    }`}
                  >
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    ) : (
                      <RichText text={m.content} />
                    )}
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                      {m.latencyMs !== undefined && (
                        <span title={m.modelUsed}>
                          {(m.latencyMs / 1000).toFixed(1)}s · {m.modelUsed || creds.model}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(m.content, idx)}
                        className="hover:text-slate-700 underline font-medium"
                      >
                        {copiedIndex === idx ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Resposta em andamento */}
            {loading && (
              <div className="flex flex-col items-start">
                <div className="max-w-[88%] px-3.5 py-3 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-slate-900 shadow-sm">
                  {streamingText ? (
                    <RichText text={streamingText} />
                  ) : (
                    <span className="flex items-center gap-2 text-slate-500">
                      <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                      Consultando {creds.model}…
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={stop}
                  className="mt-1 px-1 text-[10px] text-slate-400 hover:text-red-600 underline font-medium"
                >
                  Parar geração
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Perguntas rápidas */}
          <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-slate-100 bg-slate-50/60 no-scrollbar">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSend(p.text)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 transition-colors"
              >
                <Icon name={p.icon} size={11} />
                {p.label}
              </button>
            ))}
          </div>

          {/* Entrada */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2">
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
              placeholder="Pergunte sobre o ERP ou peça um texto… (Enter envia, Shift+Enter quebra linha)"
              className="flex-1 resize-none rounded-xl p-2.5 text-xs border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => (loading ? stop() : handleSend())}
              disabled={!loading && !input.trim()}
              className={`h-10 px-3.5 rounded-xl font-medium text-xs flex items-center justify-center transition-colors shadow-sm ${
                loading
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white"
              }`}
            >
              {loading ? "Parar" : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
