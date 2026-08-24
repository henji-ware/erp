"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIMessage, AIProviderId } from "@/lib/ai/types";
import { activeCredentials, availableModels, configuredProviders, useAISettings } from "./useAISettings";
import { RichText } from "./RichText";
import { Icon, type IconName } from "./icons";
import { Alert } from "./ui";
import AIActionCard, { type ActionResult } from "./AIActionCard";
import {
  extractActions,
  hasUnclosedAction,
  stripUnclosedAction,
} from "@/lib/ai/action-protocol";

/**
 * Texto exibido enquanto a resposta ainda chega. Um bloco de ação já fechado
 * é removido (vira cartão no fim); um bloco ainda aberto é cortado, senão o
 * usuário vê JSON pela metade rolando na tela.
 */
function previewText(streaming: string): string {
  const base = hasUnclosedAction(streaming)
    ? stripUnclosedAction(streaming)
    : streaming;
  return extractActions(base).text;
}

interface ChatEntry extends AIMessage {
  latencyMs?: number;
  modelUsed?: string;
  isError?: boolean;
}

const WELCOME: ChatEntry = {
  role: "assistant",
  content:
    "Olá! Sou o DeskHelper AI da **DRR Projetos e Equipamentos**.\n\n" +
    "Posso ajudar com resumos de vendas, contas a pagar/receber, normas técnicas (NR12, ABNT NBR 15524), inspeções pendentes ou redigir mensagens comerciais.\n\n" +
    "Também consigo **preencher cadastros** — orçamentos, laudos, agendamentos e clientes. " +
    "Eu monto os campos e você confere e clica em *Criar*: nada é gravado sem a sua confirmação.\n\n" +
    "Como posso ajudar hoje?",
};

const QUICK_PROMPTS: Array<{ icon: IconName; label: string; text: string }> = [
  { icon: "reports", label: "Resumo de hoje", text: "Faça um resumo executivo da situação atual da DRR hoje (leads em aberto, contas vencidas e inspeções)." },
  { icon: "alert", label: "Contas vencidas", text: "Quais contas a receber e a pagar estão vencidas e quais exigem atenção imediata?" },
  { icon: "inspection", label: "Inspeções próximas", text: "Quais são as inspeções técnicas agendadas para os próximos dias?" },
  { icon: "mail", label: "Cobrança WhatsApp", text: "Gere um modelo de mensagem cordial de cobrança no WhatsApp para cliente com fatura vencida há poucos dias." },
  { icon: "bulb", label: "Oportunidades", text: "Analise os leads em aberto e sugira ações comerciais para acelerar o fechamento." },
  { icon: "plus", label: "Novo orçamento", text: "Quero criar um orçamento. Pergunte o que faltar e monte o cadastro para eu confirmar." },
  { icon: "clipboard", label: "Agendar laudo", text: "Quero agendar uma inspeção técnica com emissão de laudo. Pergunte o que faltar e monte o cadastro para eu confirmar." },
];

const DEFAULT_SIZE = { w: 500, h: 620 };
const MIN_SIZE = { w: 340, h: 380 };
const SIZE_KEY = "drr_copilot_size";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export default function CopilotWidget() {
  const { settings } = useAISettings();
  const [isOpen, setIsOpen] = useState(false);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [messages, setMessages] = useState<ChatEntry[]>([WELCOME]);
  // Ações já confirmadas, por posição na conversa. Fica NESTE componente, que
  // permanece montado com o painel fechado — dentro do cartão, fechar e
  // reabrir o Copilot rearmava o botão "Criar" e duplicava o registro.
  const [doneActions, setDoneActions] = useState<Record<string, ActionResult>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [retryNotice, setRetryNotice] = useState("");
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
  const userModels = availableModels(settings, creds.provider);
  const readyProviders = configuredProviders(settings);

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

  // Recupera o tamanho escolhido antes e mantém a janela dentro da tela quando
  // o navegador é redimensionado.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s?.w === "number" && typeof s?.h === "number") setSize(s);
      }
    } catch {
      // valor inválido: fica no padrão
    }

    const onResize = () =>
      setSize((s) => ({
        w: clamp(s.w, MIN_SIZE.w, window.innerWidth - 32),
        h: clamp(s.h, MIN_SIZE.h, window.innerHeight - 32),
      }));
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Redimensionamento: o tamanho fica guardado por navegador, para não ter que
  // reajustar a janela toda vez que abrir.
  const resetSize = useCallback(() => {
    setSize(DEFAULT_SIZE);
    try {
      localStorage.removeItem(SIZE_KEY);
    } catch {
      // localStorage indisponível
    }
  }, []);

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = size.w;
      const startH = size.h;

      const onMove = (ev: PointerEvent) => {
        // Ancorado embaixo à direita: arrastar para a esquerda/cima aumenta.
        setSize({
          w: clamp(startW - (ev.clientX - startX), MIN_SIZE.w, window.innerWidth - 32),
          h: clamp(startH - (ev.clientY - startY), MIN_SIZE.h, window.innerHeight - 32),
        });
      };

      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        setSize((s) => {
          try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(s));
          } catch {
            // localStorage indisponível
          }
          return s;
        });
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [size.w, size.h]
  );

  const handleSend = async (customText?: string) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend || loading) return;
    if (!creds.model) return;

    const nextMessages: ChatEntry[] = [...messages, { role: "user", content: textToSend }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStreamingText("");
    setRetryNotice("");

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
            } else if (evt.type === "retry") {
              // Falha passageira do provedor: o servidor já vai tentar de novo.
              setRetryNotice(
                `O provedor está sobrecarregado. Tentando novamente (${evt.attempt}/${evt.of})…`
              );
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
      setRetryNotice("");
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

  // Sem botão flutuante: o DeskHelper AI é aberto pela sidebar ou pelo Ctrl+K.
  // Fechado, este componente não desenha nada.
  return (
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-label="DeskHelper AI"
          style={{ width: size.w, height: size.h }}
          className="fixed bottom-4 right-4 z-50 max-w-[95vw] max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up"
        >
          {/* Puxador de redimensionamento. O painel é ancorado embaixo à
              direita, então arrastar este canto para cima/esquerda aumenta. */}
          <div
            onPointerDown={startResize}
            onDoubleClick={resetSize}
            role="separator"
            aria-label="Redimensionar a janela do DeskHelper AI"
            title="Arraste para redimensionar (duplo clique restaura)"
            className="absolute top-0 left-0 z-20 h-5 w-5 cursor-nwse-resize touch-none"
          >
            <span className="absolute top-1.5 left-1.5 h-2.5 w-2.5 border-l-2 border-t-2 border-white/45 rounded-tl-sm" />
          </div>

          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 pl-6 surface-dark border-b">
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg on-dark-chip"
                aria-hidden
              >
                <Icon name="ai" size={15} />
              </span>
              <div>
                <h2 className="text-sm font-bold leading-tight">DeskHelper AI · DRR</h2>
                <p className="text-[11px] surface-dark-muted">Conectado aos dados do ERP</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMessages([WELCOME])}
                title="Limpar conversa"
                disabled={loading}
                className="px-2 py-1 rounded surface-dark-muted on-dark-hover text-xs disabled:opacity-40 transition-colors"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar Copilot"
                className="p-1.5 rounded surface-dark-muted on-dark-hover transition-colors"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          </div>

          {/* Seletor rápido de provedor e modelo */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs">
            {/* Bolinha de status: verde quando há modelo carregado, âmbar
                quando o painel está sem configuração utilizável. */}
            <span
              aria-hidden="true"
              className={`mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                creds.model ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <select
              value={creds.provider}
              aria-label="Provedor de IA"
              title="Provedor de IA"
              onChange={(e) => {
                setProviderOverride(e.target.value as AIProviderId);
                setModelOverride("");
              }}
              className="max-w-[42%] shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-brand-500"
            >
              {/* Só provedores que já tiveram os modelos carregados da conta.
                  Listar os onze fazia escolher um sem chave trazer um modelo
                  inventado do catálogo. */}
              {readyProviders.map((id) => (
                <option key={id} value={id}>
                  {AI_PROVIDERS[id].name}
                </option>
              ))}
              {!readyProviders.includes(creds.provider) && (
                <option value={creds.provider}>{AI_PROVIDERS[creds.provider].name}</option>
              )}
            </select>

            <select
              value={creds.model}
              aria-label="Modelo de IA"
              title="Modelo de IA"
              onChange={(e) => setModelOverride(e.target.value)}
              className="min-w-0 flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-brand-500"
            >
              {/* Só os modelos que a chave do usuário realmente aceita. */}
              {!creds.model && <option value="">Nenhum modelo configurado</option>}
              {creds.model && !userModels.includes(creds.model) && (
                <option value={creds.model}>{creds.model}</option>
              )}
              {userModels.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-[13px] bg-slate-50/40">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              // Blocos ```drr-acao saem do texto e viram cartão de
              // confirmação — na conversa eles apareceriam como JSON cru.
              const parsed = isUser
                ? { text: m.content, actions: [] }
                : extractActions(m.content);
              return (
                <div key={idx} className={`flex w-full flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[88%] px-3.5 py-3 rounded-2xl leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-brand-600 text-white rounded-br-sm"
                        : m.isError
                          ? "alert-surface alert-danger rounded-bl-sm"
                          : "bg-white text-slate-900 rounded-bl-sm border border-slate-200"
                    }`}
                  >
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    ) : (
                      <RichText text={parsed.text} />
                    )}
                  </div>

                  {parsed.actions.length > 0 && (
                    <div className="w-full max-w-[88%]">
                      {parsed.actions.map((action, i) => {
                        const key = `${idx}-${i}`;
                        return (
                          <AIActionCard
                            key={key}
                            action={action}
                            result={doneActions[key]}
                            onDone={(r) =>
                              setDoneActions((prev) => ({ ...prev, [key]: r }))
                            }
                          />
                        );
                      })}
                    </div>
                  )}

                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-slate-500">
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
                    // Durante o streaming o bloco de ação chega pela metade;
                    // mostrar isso seria JSON quebrado rolando na tela. O
                    // cartão aparece quando a mensagem fecha.
                    <RichText text={previewText(streamingText)} />
                  ) : (
                    <span className="flex items-center gap-2 text-slate-500">
                      <span className="flex h-2 w-2 rounded-full bg-brand-600 animate-ping" />
                      {retryNotice || `Consultando ${creds.model}…`}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={stop}
                  className="mt-1 px-1 text-[11px] text-slate-500 hover:text-red-600 underline font-medium"
                >
                  Parar geração
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sem modelo carregado não dá para conversar: dizer isso é melhor
              que deixar o botão Enviar sem efeito. */}
          {!creds.model && (
            <Alert tone="warn" size="sm" className="mx-3 mb-2">
              Nenhum modelo configurado. Abra{" "}
              <a href="/settings#ia" className="font-semibold underline">
                Configurações › Inteligência Artificial
              </a>
              , informe a chave do provedor e carregue os modelos da sua conta.
            </Alert>
          )}

          {/* Perguntas rápidas */}
          <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50/60">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSend(p.text)}
                disabled={loading || !creds.model}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-white border border-slate-200 text-slate-600 accent-hover-border hover:text-slate-900 disabled:opacity-40 transition-colors"
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
              className="flex-1 resize-none rounded-xl p-2.5 text-[13px] border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => (loading ? stop() : handleSend())}
              disabled={!loading && (!input.trim() || !creds.model)}
              className={`h-10 px-4 rounded-xl font-semibold text-[13px] flex items-center justify-center transition-colors shadow-sm ${
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
