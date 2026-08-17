"use client";

import { useState, useEffect } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIModelInfo, AIProviderId, AISettingsData } from "@/lib/ai/types";
import { AI_SETTINGS_COOKIE, getDefaultAISettings } from "@/lib/ai/settings";

export default function AISettings({
  initialSettings,
}: {
  initialSettings?: AISettingsData;
}) {
  const [settings, setSettings] = useState<AISettingsData>(
    initialSettings || getDefaultAISettings()
  );
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>("gemini");
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsMap, setModelsMap] = useState<Record<string, AIModelInfo[]>>({});
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
    latency?: number;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Carrega configurações salvas no localStorage/cookie ao montar
  useEffect(() => {
    try {
      const local = localStorage.getItem("drr_ai_settings");
      if (local) {
        const parsed = JSON.parse(local);
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          apiKeys: { ...prev.apiKeys, ...parsed.apiKeys },
          defaultModels: { ...prev.defaultModels, ...parsed.defaultModels },
          customBaseUrls: { ...prev.customBaseUrls, ...parsed.customBaseUrls },
        }));
        if (parsed.activeProvider) {
          setSelectedProvider(parsed.activeProvider);
        }
      }
    } catch {}
  }, []);

  const currentConfig = AI_PROVIDERS[selectedProvider];
  const activeModel =
    settings.defaultModels[selectedProvider] || currentConfig?.defaultModel;
  const currentApiKey = settings.apiKeys[selectedProvider] || "";
  const currentBaseUrl = settings.customBaseUrls[selectedProvider] || "";
  const currentModels =
    modelsMap[selectedProvider] || currentConfig?.models || [];

  const saveSettings = (newSettings: AISettingsData) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("drr_ai_settings", JSON.stringify(newSettings));
      // Salva no cookie para Server Actions / Server Components
      document.cookie = `${AI_SETTINGS_COOKIE}=${encodeURIComponent(
        JSON.stringify(newSettings)
      )}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleKeyChange = (val: string) => {
    const next = {
      ...settings,
      apiKeys: {
        ...settings.apiKeys,
        [selectedProvider]: val,
      },
    };
    saveSettings(next);
  };

  const handleBaseUrlChange = (val: string) => {
    const next = {
      ...settings,
      customBaseUrls: {
        ...settings.customBaseUrls,
        [selectedProvider]: val,
      },
    };
    saveSettings(next);
  };

  const handleModelSelect = (modelId: string) => {
    const next = {
      ...settings,
      defaultModels: {
        ...settings.defaultModels,
        [selectedProvider]: modelId,
      },
    };
    saveSettings(next);
  };

  const handleSetActiveProvider = (provId: AIProviderId) => {
    const next = {
      ...settings,
      activeProvider: provId,
    };
    saveSettings(next);
  };

  const fetchLiveModels = async () => {
    setLoadingModels(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: currentApiKey,
          baseUrl: currentBaseUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível carregar modelos.");
      }

      setModelsMap((prev) => ({
        ...prev,
        [selectedProvider]: data.models,
      }));

      setTestResult({
        ok: true,
        msg: `✅ ${data.count} modelos disponíveis carregados com sucesso da API!`,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: `❌ ${err.message}`,
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const testConnection = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: activeModel,
          apiKey: currentApiKey,
          baseUrl: currentBaseUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Falha na conexão.");
      }

      setTestResult({
        ok: true,
        latency: data.latencyMs,
        msg: `✅ Conectado com sucesso ao ${data.model} em ${data.latencyMs}ms!`,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: `❌ ${err.message}`,
      });
    } finally {
      setTestingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Provedor Ativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Provedor Padrão Ativo no ERP
            </p>
          </div>
          <p className="mt-1 text-lg font-bold text-white flex items-center gap-2">
            {AI_PROVIDERS[settings.activeProvider]?.name || "Gemini"}
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 font-mono font-normal">
              {settings.defaultModels[settings.activeProvider] ||
                AI_PROVIDERS[settings.activeProvider]?.defaultModel}
            </span>
          </p>
        </div>
        {savedSuccess && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 animate-fade-in">
            ✓ Configurações salvas automaticamente
          </span>
        )}
      </div>

      {/* Grid de Provedores */}
      <div>
        <label className="label mb-2 font-medium">Selecione o Provedor para Configurar:</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.values(AI_PROVIDERS).map((p) => {
            const isSelected = selectedProvider === p.id;
            const isDefault = settings.activeProvider === p.id;
            const hasKey = Boolean(settings.apiKeys[p.id]);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProvider(p.id);
                  setTestResult(null);
                }}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-brand-500 bg-brand-500/5 shadow-md ring-2 ring-brand-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white dark:bg-slate-900/50"
                }`}
              >
                {isDefault && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-500" title="Provedor Ativo" />
                )}
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {p.name.split(" ")[0]}
                </span>
                <span className="text-[11px] text-slate-400 truncate w-full mt-0.5">
                  {p.name.includes(" ") ? p.name.split(" ").slice(1).join(" ") : p.tagline.slice(0, 16)}
                </span>
                {hasKey && (
                  <span className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ● Chave salva
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do Provedor Selecionado */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 dark:bg-slate-900/30 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {currentConfig.name}
              </h3>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${currentConfig.badgeColor}`}>
                {currentConfig.tagline}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{currentConfig.description}</p>
          </div>

          <button
            type="button"
            onClick={() => handleSetActiveProvider(selectedProvider)}
            className={`btn-sm ${
              settings.activeProvider === selectedProvider
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "btn-secondary"
            }`}
          >
            {settings.activeProvider === selectedProvider
              ? "✓ Provedor Principal"
              : "Definir como Principal"}
          </button>
        </div>

        {/* Inputs de Chave e Base URL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentConfig.requiresApiKey && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs">
                  Chave de API ({currentConfig.keyEnvVar})
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                >
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={currentApiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder={`Cole sua ${currentConfig.keyEnvVar} ou deixe vazio se estiver no .env`}
                  className="input text-xs font-mono pr-8"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Se já configurada no <code className="font-mono">.env</code> do servidor, você pode deixar este campo em branco.
              </p>
            </div>
          )}

          <div>
            <label className="label text-xs mb-1">
              URL Base da API (Endpoint Customizado)
            </label>
            <input
              type="text"
              value={currentBaseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder={currentConfig.defaultBaseUrl || "https://api.openai.com/v1"}
              className="input text-xs font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Padrão: <code className="font-mono">{currentConfig.defaultBaseUrl || "Padrão do serviço"}</code>
            </p>
          </div>
        </div>

        {/* Ações de Teste e Busca de Modelos */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={fetchLiveModels}
            disabled={loadingModels}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            {loadingModels ? (
              <span className="inline-block animate-spin">⟳</span>
            ) : (
              <span>🔄</span>
            )}
            Carregar modelos disponíveis na minha conta
          </button>

          <button
            type="button"
            onClick={testConnection}
            disabled={testingKey}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            {testingKey ? (
              <span className="inline-block animate-spin">⟳</span>
            ) : (
              <span>⚡</span>
            )}
            Testar Conexão e Latência
          </button>
        </div>

        {/* Feedback de Teste */}
        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between animate-fade-in ${
              testResult.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            <span>{testResult.msg}</span>
            {testResult.latency && (
              <span className="font-mono text-[11px] font-semibold">
                {testResult.latency}ms
              </span>
            )}
          </div>
        )}

        {/* Lista Completa de Modelos */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Modelos Disponíveis ({currentModels.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Clique em um modelo para defini-lo como padrão
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {currentModels.map((m) => {
              const isCurrent = activeModel === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleModelSelect(m.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isCurrent
                      ? "border-brand-500 bg-brand-500/10 dark:bg-brand-500/20 ring-1 ring-brand-500/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {m.name}
                      {m.isNew && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">
                          Novo
                        </span>
                      )}
                    </span>
                    {isCurrent ? (
                      <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                        ● Ativo
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {m.contextWindow || ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                    {m.description || m.id}
                  </p>
                  <div className="mt-1.5 text-[10px] font-mono text-slate-400 truncate">
                    ID: {m.id}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Campo para Digitar ID Customizado */}
          <div className="pt-2">
            <label className="label text-xs mb-1">
              Ou digite manualmente um identificador de modelo:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: claude-3-7-sonnet-20250219 ou gpt-4.5-preview"
                className="input text-xs font-mono flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) handleModelSelect(val);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
