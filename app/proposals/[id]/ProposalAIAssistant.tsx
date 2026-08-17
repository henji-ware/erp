"use client";

import { useState, useEffect } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIProviderId } from "@/lib/ai/types";

interface ProposalAIAssistantProps {
  proposalId: number;
  proposalType: string;
  clientName: string;
  title: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  currentScope?: string;
  findings?: string;
  onApplyScope?: (text: string) => void;
}

export default function ProposalAIAssistant({
  proposalId,
  proposalType,
  clientName,
  title,
  items,
  currentScope,
  findings,
  onApplyScope,
}: ProposalAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generationType, setGenerationType] = useState<"scope" | "commercial" | "findings" | "full">("scope");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Carrega configurações salvas de IA
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

  const handleProviderChange = (newProv: AIProviderId) => {
    setSelectedProvider(newProv);
    const defModel = AI_PROVIDERS[newProv]?.defaultModel || "default";
    setSelectedModel(defModel);
    try {
      const local = localStorage.getItem("drr_ai_settings");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.apiKeys?.[newProv]) setApiKey(parsed.apiKeys[newProv]);
        else setApiKey("");
      }
    } catch {}
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedText("");
    setAppliedSuccess(false);

    try {
      const res = await fetch("/api/ai/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: generationType,
          proposalType,
          clientName,
          title,
          items,
          currentScope,
          findings,
          customInstructions,
          provider: selectedProvider,
          model: selectedModel,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erro ao gerar proposta com IA.");
      }

      setGeneratedText(data.text);
    } catch (err: any) {
      alert(`Erro na geração: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToForm = () => {
    if (!generatedText) return;

    // Tenta encontrar o textarea do escopo ou aciona callback
    if (onApplyScope) {
      onApplyScope(generatedText);
    } else {
      const scopeTextarea = document.querySelector('textarea[name="scope"]') as HTMLTextAreaElement;
      if (scopeTextarea) {
        scopeTextarea.value = generatedText;
        scopeTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    navigator.clipboard.writeText(generatedText);
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      setIsOpen(false);
    }, 1200);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 transition-colors shadow-xs"
      >
        <span>✨</span> Assistente de IA para Propostas
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 text-base">
                  ✨
                </span>
                <div>
                  <h3 className="text-sm font-bold">Assistente de IA · Elaboração de Proposta</h3>
                  <p className="text-xs text-slate-400">
                    {clientName} · {title} ({proposalType})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white text-base leading-none"
              >
                ✕
              </button>
            </div>

            {/* Controles de Configuração e Provedor */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Seletor de Modelo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="label text-[11px] mb-1">Provedor de IA:</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
                    className="input text-xs font-semibold"
                  >
                    {Object.values(AI_PROVIDERS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-[11px] mb-1">Modelo Selecionado:</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="input text-xs font-mono"
                  >
                    {AI_PROVIDERS[selectedProvider]?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tipo de Geração */}
              <div>
                <label className="label text-xs mb-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  O que você deseja que a IA elabore?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "scope", label: "📋 Escopo Técnico", desc: "Etapas e Normas NR12/ABNT" },
                    { id: "commercial", label: "💼 Termos Comerciais", desc: "Garantia e Condições" },
                    { id: "findings", label: "🔍 Análise de Riscos", desc: "Laudo Verde/Amarelo/Verm." },
                    { id: "full", label: "✍️ Revisar & Polir", desc: "Melhorar texto atual" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setGenerationType(t.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        generationType === t.id
                          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-semibold"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <p className="text-xs">{t.label}</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instruções Adicionais */}
              <div>
                <label className="label text-xs mb-1">
                  Instruções Adicionais / Particularidades da Obra:
                </label>
                <textarea
                  rows={2}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ex: enfatizar garantia estendida de 3 anos, entrega em até 10 dias úteis e inclusão de ART por engenheiro civil habilitado..."
                  className="input text-xs"
                />
              </div>

              {/* Botão Gerar */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold shadow-sm"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin">⟳</span> Gerando com {selectedModel}...
                  </>
                ) : (
                  <>
                    <span>✨</span> Gerar Texto com IA
                  </>
                )}
              </button>

              {/* Resultado Gerado */}
              {generatedText && (
                <div className="space-y-2 pt-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Resultado Gerado pela IA:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Revise antes de aplicar
                    </span>
                  </div>

                  <textarea
                    rows={8}
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                    className="input text-xs font-mono leading-relaxed"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedText);
                        alert("Texto copiado para a área de transferência!");
                      }}
                      className="btn-secondary btn-sm"
                    >
                      Copiar Texto
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyToForm}
                      className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {appliedSuccess ? "✓ Inserido no Escopo!" : "Inserir no Escopo da Proposta"}
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
