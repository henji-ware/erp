"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIModelInfo, AIProviderId, AISettingsData } from "@/lib/ai/types";
import { useAISettings } from "../components/useAISettings";
import { Icon } from "../components/icons";

export default function AISettings({
  initialSettings,
}: {
  initialSettings?: AISettingsData;
}) {
  const { settings, setSettings, loaded } = useAISettings();
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(
    initialSettings?.activeProvider || "gemini"
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsMap, setModelsMap] = useState<Partial<Record<AIProviderId, AIModelInfo[]>>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; latency?: number } | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [manualModel, setManualModel] = useState("");

  // Rascunhos locais dos campos de texto: gravar a cada tecla escrevia o
  // localStorage e o cookie caractere por caractere e piscava o aviso de
  // "salvo". Agora o commit acontece ao sair do campo ou após uma pausa.
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentConfig = AI_PROVIDERS[selectedProvider];
  const activeModel = settings.defaultModels[selectedProvider] || currentConfig?.defaultModel || "";
  const storedKey = settings.apiKeys[selectedProvider] || "";
  const storedUrl = settings.customBaseUrls[selectedProvider] || "";
  const currentKey = keyDraft ?? storedKey;
  const currentUrl = urlDraft ?? storedUrl;

  const models = useMemo(
    () => modelsMap[selectedProvider] || currentConfig?.models || [],
    [modelsMap, selectedProvider, currentConfig]
  );

  // Assim que o localStorage é lido, o painel abre no provedor que está ativo.
  useEffect(() => {
    if (loaded) setSelectedProvider(settings.activeProvider);
    // só na carga inicial: depois quem manda é o clique do usuário
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const commit = (patch: Partial<AISettingsData>) => {
    setSettings({ ...settings, ...patch });
    setSavedAt(Date.now());
  };

  const commitKey = (value: string) => {
    setKeyDraft(null);
    if (value === storedKey) return;
    commit({ apiKeys: { ...settings.apiKeys, [selectedProvider]: value } });
  };

  const commitUrl = (value: string) => {
    setUrlDraft(null);
    if (value === storedUrl) return;
    commit({ customBaseUrls: { ...settings.customBaseUrls, [selectedProvider]: value } });
  };

  const scheduleCommit = (fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, 800);
  };

  const selectModel = (modelId: string) => {
    const id = modelId.trim();
    if (!id) return;
    commit({ defaultModels: { ...settings.defaultModels, [selectedProvider]: id } });
  };

  const switchProvider = (id: AIProviderId) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setKeyDraft(null);
    setUrlDraft(null);
    setSelectedProvider(id);
    setTestResult(null);
    setShowKey(false);
    setManualModel("");
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
          apiKey: currentKey,
          baseUrl: currentUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Não foi possível carregar modelos.");

      setModelsMap((prev) => ({ ...prev, [selectedProvider]: data.models }));
      setTestResult({ ok: true, msg: `${data.count} modelos carregados da sua conta.` });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setLoadingModels(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          model: activeModel,
          apiKey: currentKey,
          baseUrl: currentUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha na conexão.");

      setTestResult({
        ok: true,
        latency: data.latencyMs,
        msg: `Conectado a ${data.model}.`,
      });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const justSaved = savedAt > 0 && Date.now() - savedAt < 2500;

  return (
    <div className="space-y-6">
      {/* Provedor ativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl surface-dark border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <p className="text-xs font-semibold uppercase tracking-wider surface-dark-muted">
              Provedor padrão do ERP
            </p>
          </div>
          <p className="mt-1 text-lg font-bold flex flex-wrap items-center gap-2">
            {AI_PROVIDERS[settings.activeProvider]?.name}
            <span className="text-xs px-2 py-0.5 rounded-full on-dark-chip font-mono font-normal">
              {settings.defaultModels[settings.activeProvider] ||
                AI_PROVIDERS[settings.activeProvider]?.defaultModel}
            </span>
          </p>
        </div>
        {justSaved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 animate-fade-in">
            <Icon name="check" size={12} /> Salvo
          </span>
        )}
      </div>

      {/* Aviso de onde a chave é guardada */}
      <p className="text-xs text-slate-500 leading-relaxed rounded-lg border border-slate-200 bg-slate-50 p-3">
        As chaves de API ficam salvas <strong>somente neste navegador</strong> e são enviadas ao
        servidor apenas no momento de cada consulta — nunca em cookie. Para uma chave compartilhada
        por toda a equipe, defina a variável de ambiente correspondente no servidor e deixe o campo
        em branco.
      </p>

      {/* Grade de provedores */}
      <div>
        <label className="label mb-2 font-medium">Provedor a configurar</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.values(AI_PROVIDERS).map((p) => {
            const isSelected = selectedProvider === p.id;
            const isDefault = settings.activeProvider === p.id;
            const hasKey = Boolean(settings.apiKeys[p.id]);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => switchProvider(p.id)}
                aria-pressed={isSelected}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-brand-500 bg-brand-500/5 shadow-md ring-2 ring-brand-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                {isDefault && (
                  <span
                    className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-500"
                    title="Provedor ativo"
                  />
                )}
                <span className="text-xs font-bold text-slate-800">{p.name.split(" ")[0]}</span>
                <span className="text-xs text-slate-500 truncate w-full mt-0.5">
                  {p.name.includes(" ") ? p.name.split(" ").slice(1).join(" ") : p.tagline.slice(0, 18)}
                </span>
                {hasKey && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Chave salva
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do provedor */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{currentConfig?.name}</h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${currentConfig?.badgeColor}`}
              >
                {currentConfig?.tagline}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{currentConfig?.description}</p>
          </div>

          <button
            type="button"
            onClick={() => commit({ activeProvider: selectedProvider })}
            disabled={settings.activeProvider === selectedProvider}
            className={
              settings.activeProvider === selectedProvider
                ? "btn btn-sm bg-emerald-600 text-white disabled:opacity-100 shrink-0"
                : "btn-secondary btn-sm shrink-0"
            }
          >
            {settings.activeProvider === selectedProvider ? (
              <>
                <Icon name="check" size={13} /> Provedor principal
              </>
            ) : (
              "Definir como principal"
            )}
          </button>
        </div>

        {/* Chave e URL base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentConfig?.requiresApiKey && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="ai-key" className="label text-xs mb-0">
                  Chave de API ({currentConfig.keyEnvVar})
                </label>
                <div className="flex items-center gap-2">
                  {storedKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeyDraft("");
                        commitKey("");
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    {showKey ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
              {/* type="text" + máscara por CSS, de propósito: com type="password"
                  o navegador trata o campo como login e preenche sozinho com a
                  senha salva do site — o gerenciador de senhas não sabe que aqui
                  se espera uma chave de API. Os data-* desligam 1Password,
                  LastPass e Dashlane. */}
              <input
                id="ai-key"
                type="text"
                name="drr-ai-provider-key"
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-form-type="other"
                value={currentKey}
                onChange={(e) => {
                  const v = e.target.value;
                  setKeyDraft(v);
                  scheduleCommit(() => commitKey(v));
                }}
                onBlur={(e) => commitKey(e.target.value)}
                placeholder={`Cole sua ${currentConfig.keyEnvVar} ou deixe em branco`}
                className={`input text-xs ${showKey ? "font-mono" : "input-secret"}`}
              />
              {currentKey && !/^(sk-|gsk_|xai-|csk-|AIza|co-|or-|[A-Za-z0-9_-]{24,})/.test(currentKey.trim()) && (
                <p className="mt-1 text-xs text-amber-600">
                  Isto não parece uma chave de API. Se o navegador preencheu o campo
                  com uma senha salva, clique em Remover.
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Já configurada no <code className="font-mono">.env</code> do servidor? Deixe em branco.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="ai-url" className="label text-xs mb-1">
              URL base da API (endpoint customizado)
            </label>
            <input
              id="ai-url"
              type="text"
              spellCheck={false}
              value={currentUrl}
              onChange={(e) => {
                const v = e.target.value;
                setUrlDraft(v);
                scheduleCommit(() => commitUrl(v));
              }}
              onBlur={(e) => commitUrl(e.target.value)}
              placeholder={currentConfig?.defaultBaseUrl || "https://api.openai.com"}
              className="input text-xs font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">
              Padrão: <code className="font-mono">{currentConfig?.defaultBaseUrl || "padrão do serviço"}</code>
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={fetchLiveModels}
            disabled={loadingModels}
            className="btn-secondary btn-sm"
          >
            {loadingModels ? "Carregando…" : "Carregar modelos da minha conta"}
          </button>

          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="btn-primary btn-sm"
          >
            {testing ? "Testando…" : "Testar conexão"}
          </button>
        </div>

        {testResult && (
          <div
            role="status"
            className={`p-3 rounded-xl text-xs flex items-start justify-between gap-3 animate-fade-in border ${
              testResult.ok
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <span className="flex items-start gap-1.5 leading-relaxed">
              <span className="mt-0.5 shrink-0">
                <Icon name={testResult.ok ? "check" : "close"} size={13} />
              </span>
              {testResult.msg}
            </span>
            {testResult.latency !== undefined && (
              <span className="font-mono text-xs font-semibold shrink-0">
                {testResult.latency}ms
              </span>
            )}
          </div>
        )}

        {/* Modelos */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Modelos disponíveis ({models.length})
            </h4>
            <span className="text-xs text-slate-500">Clique para definir como padrão</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {models.map((m) => {
              const isCurrent = activeModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectModel(m.id)}
                  aria-pressed={isCurrent}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isCurrent
                      ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{m.name}</span>
                      {m.isNew && (
                        <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 font-semibold">
                          Novo
                        </span>
                      )}
                    </span>
                    {isCurrent ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                        {/* Só o ponto usa a cor do tema: como texto ela fica com
                            contraste baixo sobre o fundo claro do cartão. */}
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                        Ativo
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-500 font-mono">
                        {m.contextWindow || ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {m.description || m.id}
                  </p>
                  <div className="mt-1.5 text-[11px] font-mono text-slate-500 truncate">{m.id}</div>
                </button>
              );
            })}
          </div>

          {/* ID manual */}
          <div className="pt-1">
            <label htmlFor="ai-manual" className="label text-xs mb-1">
              Ou informe manualmente o identificador de um modelo
            </label>
            <div className="flex gap-2">
              <input
                id="ai-manual"
                type="text"
                spellCheck={false}
                value={manualModel}
                onChange={(e) => setManualModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    selectModel(manualModel);
                    setManualModel("");
                  }
                }}
                placeholder="Ex.: claude-sonnet-5 ou gpt-4o"
                className="input text-xs font-mono flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  selectModel(manualModel);
                  setManualModel("");
                }}
                disabled={!manualModel.trim()}
                className="btn-secondary btn-sm shrink-0"
              >
                Usar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
