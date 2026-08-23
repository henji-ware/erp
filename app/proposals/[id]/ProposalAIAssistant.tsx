"use client";

import { useEffect, useRef, useState } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIProviderId } from "@/lib/ai/types";
import { activeCredentials, availableModels, configuredProviders, useAISettings } from "../../components/useAISettings";
import { Icon, type IconName } from "../../components/icons";
import { Alert } from "../../components/ui";

interface ProposalAIAssistantProps {
  proposalType: string;
  clientName: string;
  title: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  currentScope?: string;
  findings?: string;
  onApplyScope?: (text: string) => void;
}

type GenerationType = "scope" | "commercial" | "findings" | "full";

const TYPES: Array<{ id: GenerationType; icon: IconName; label: string; desc: string }> = [
  { id: "scope", icon: "clipboard", label: "Escopo técnico", desc: "Etapas e normas NR12/ABNT" },
  { id: "commercial", icon: "briefcase", label: "Termos comerciais", desc: "Garantia e condições" },
  { id: "findings", icon: "inspection", label: "Análise de riscos", desc: "Laudo verde/amarelo/vermelho" },
  { id: "full", icon: "pen", label: "Revisar e polir", desc: "Melhorar o texto atual" },
];

export default function ProposalAIAssistant({
  proposalType,
  clientName,
  title,
  items,
  currentScope,
  findings,
  onApplyScope,
}: ProposalAIAssistantProps) {
  const { settings } = useAISettings();
  const [isOpen, setIsOpen] = useState(false);
  const [generationType, setGenerationType] = useState<GenerationType>("scope");
  const [customInstructions, setCustomInstructions] = useState("");
  const [providerOverride, setProviderOverride] = useState<AIProviderId | "">("");
  const [modelOverride, setModelOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [feedback, setFeedback] = useState("");
  // Modelo e tempo da última geração: com onze provedores e troca rápida no
  // seletor, dizer QUEM escreveu o texto evita comparar versões no escuro.
  const [lastRun, setLastRun] = useState<{ model: string; ms: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Proposta é documento que vai ao cliente: saber o tamanho antes de aplicar
  // importa mais aqui do que num chat.
  const wordCount = generatedText.trim() ? generatedText.trim().split(/\s+/).length : 0;

  const creds = activeCredentials(settings, {
    provider: providerOverride || undefined,
    model: modelOverride || undefined,
  });
  const userModels = availableModels(settings, creds.provider);
  const readyProviders = configuredProviders(settings);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, loading]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setFeedback("");
    setGeneratedText("");
    setLastRun(null);

    const startedAt = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          type: generationType,
          proposalType,
          clientName,
          title,
          items,
          currentScope,
          findings,
          customInstructions,
          provider: creds.provider,
          model: creds.model,
          apiKey: creds.apiKey,
          baseUrl: creds.baseUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao gerar texto com IA.");
      if (!data.text?.trim()) throw new Error("O modelo devolveu um texto vazio. Tente outro modelo.");

      setGeneratedText(data.text);
      setLastRun({
        model: data.model || creds.model,
        ms: typeof data.latencyMs === "number" ? data.latencyMs : Date.now() - startedAt,
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") setError(err.message);
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  /**
   * Leva o texto para o campo de escopo.
   *
   * `mode: "append"` existe porque substituir era a única opção: quem já
   * tinha escrito meia proposta e pedia "análise de riscos" perdia o que
   * havia digitado, sem desfazer.
   */
  const handleApplyToForm = (mode: "replace" | "append" = "replace") => {
    if (!generatedText) return;

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="scope"]');
    const current = onApplyScope ? currentScope ?? "" : (textarea?.value ?? "");
    const next =
      mode === "append" && current.trim()
        ? `${current.trimEnd()}\n\n${generatedText}`
        : generatedText;

    if (onApplyScope) {
      onApplyScope(next);
      setFeedback(
        mode === "append"
          ? "Texto acrescentado ao final do escopo. Não esqueça de salvar."
          : "Texto inserido no escopo. Não esqueça de salvar a proposta.",
      );
      return;
    }

    // Sem callback: escreve direto no textarea do formulário. O setter nativo é
    // necessário porque o React ignora a atribuição direta em .value.
    if (!textarea) {
      setError("Campo de escopo não encontrado nesta tela. Use o botão Copiar.");
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(textarea, next);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    setFeedback(
      mode === "append"
        ? "Texto acrescentado ao final do escopo. Não esqueça de salvar."
        : "Texto inserido no escopo. Não esqueça de salvar a proposta.",
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setFeedback("Texto copiado para a área de transferência.");
    } catch {
      setError("O navegador bloqueou a cópia automática. Selecione o texto e copie manualmente.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg accent-soft accent-border text-slate-900 text-xs font-semibold transition-colors shadow-sm"
      >
        <Icon name="ai" size={14} /> Assistente de IA
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => !loading && setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Assistente de IA para propostas"
            className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-5 py-4 surface-dark border-b">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl on-dark-chip"
                  aria-hidden
                >
                  <Icon name="ai" size={16} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">Assistente de IA · Elaboração de proposta</h3>
                  <p className="text-xs surface-dark-muted truncate">
                    {clientName} · {title} ({proposalType})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className="p-1.5 rounded surface-dark-muted on-dark-hover transition-colors"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Provedor e modelo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label htmlFor="prop-provider" className="label text-xs mb-1">
                    Provedor de IA
                  </label>
                  <select
                    id="prop-provider"
                    value={creds.provider}
                    onChange={(e) => {
                      setProviderOverride(e.target.value as AIProviderId);
                      setModelOverride("");
                    }}
                    className="input text-xs font-semibold"
                  >
                    {readyProviders.map((id) => (
                      <option key={id} value={id}>
                        {AI_PROVIDERS[id].name}
                      </option>
                    ))}
                    {!readyProviders.includes(creds.provider) && (
                      <option value={creds.provider}>{AI_PROVIDERS[creds.provider].name}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="prop-model" className="label text-xs mb-1">
                    Modelo
                  </label>
                  <select
                    id="prop-model"
                    value={creds.model}
                    onChange={(e) => setModelOverride(e.target.value)}
                    className="input text-xs font-mono"
                  >
                    {/* Só os modelos que a chave do usuário realmente aceita. */}
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
              </div>

              {/* Tipo de geração */}
              <div>
                <span className="label text-xs mb-1.5 font-semibold text-slate-800 block">
                  O que a IA deve elaborar?
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setGenerationType(t.id)}
                      aria-pressed={generationType === t.id}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        generationType === t.id
                          ? "accent-selected text-slate-900 font-semibold"
                          : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      <p className="text-xs flex items-center gap-1.5">
                        <Icon name={t.icon} size={13} />
                        {t.label}
                      </p>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instruções */}
              <div>
                <label htmlFor="prop-instructions" className="label text-xs mb-1">
                  Instruções adicionais / particularidades da obra
                </label>
                <textarea
                  id="prop-instructions"
                  rows={2}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ex.: enfatizar garantia estendida de 3 anos, entrega em até 10 dias úteis, ART por engenheiro habilitado…"
                  className="input text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="btn-primary w-full py-2.5 text-xs font-semibold"
              >
                {loading ? (
                  `Gerando com ${creds.model}…`
                ) : (
                  <>
                    <Icon name="ai" size={14} /> Gerar texto com IA
                  </>
                )}
              </button>

              {/* `bg-emerald-50` não é token do tema: no modo escuro a caixa
                  de sucesso ficava verde-clarinha brilhando na tela. */}
              {error && <Alert tone="danger" size="sm">{error}</Alert>}
              {feedback && <Alert tone="success" size="sm">{feedback}</Alert>}

              {/* Resultado */}
              {generatedText && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-xs font-bold text-slate-800">Resultado gerado</span>
                    <span className="text-[11px] text-slate-500">
                      {wordCount} palavras · {generatedText.length} caracteres
                      {lastRun && ` · ${lastRun.model} em ${(lastRun.ms / 1000).toFixed(1)}s`}
                    </span>
                  </div>

                  <textarea
                    rows={10}
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                    className="input text-xs leading-relaxed"
                  />

                  <p className="text-[11px] text-slate-400">
                    Revise antes de aplicar — o texto é um rascunho, e a
                    responsabilidade técnica continua sendo do engenheiro.
                  </p>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="btn-secondary btn-sm mr-auto"
                      title="Gerar outra versão com as mesmas opções"
                    >
                      <Icon name="ai" size={13} /> Gerar de novo
                    </button>
                    <button type="button" onClick={handleCopy} className="btn-secondary btn-sm">
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyToForm("append")}
                      className="btn-secondary btn-sm"
                      title="Mantém o que já está escrito e acrescenta abaixo"
                    >
                      Acrescentar ao final
                    </button>
                    {/* `text-white` seria um TIRO NO PÉ aqui: `white` é token do
                        tema e aponta para a superfície, então no escuro o texto
                        do botão ficaria quase preto sobre o verde. */}
                    <button
                      type="button"
                      onClick={() => handleApplyToForm("replace")}
                      style={{ color: "#ffffff" }}
                      className="btn btn-sm bg-emerald-600 hover:bg-emerald-700"
                    >
                      Substituir o escopo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
