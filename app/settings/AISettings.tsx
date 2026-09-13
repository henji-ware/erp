"use client";

import { useEffect, useMemo, useState } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIModelInfo, AIProviderId, AISettingsData } from "@/lib/ai/types";
import { useAISettings } from "../components/useAISettings";
import { Icon } from "../components/icons";
import { Alert } from "../components/ui";
import { saveApiKey, removeApiKey } from "./ai-key-actions";
import type { CredentialView } from "@/lib/ai/credentials";

export default function AISettings({
  initialSettings,
  savedKeys = [],
  canStore = true,
  oauthAvailable = { openai: false, openrouter: false, gemini: false },
  oauthProvider,
  oauthResult,
}: {
  initialSettings?: AISettingsData;
  /**
   * Chaves já guardadas, vindas do servidor — SEM a chave em si, só a dica
   * dos últimos caracteres. É o suficiente para a pessoa reconhecer qual
   * está salva, e nada além disso chega ao navegador.
   */
  savedKeys?: CredentialView[];
  /** O servidor tem um segredo de sessão/criptografia para proteger credenciais? */
  canStore?: boolean;
  oauthAvailable?: { openai: boolean; openrouter: boolean; gemini: boolean };
  oauthProvider?: "openrouter" | "gemini";
  oauthResult?: string;
}) {
  const { settings, setSettings, loaded } = useAISettings();
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(
    oauthProvider || initialSettings?.activeProvider || "gemini"
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsMap, setModelsMap] = useState<Partial<Record<AIProviderId, AIModelInfo[]>>>({});
  const [liveLoaded, setLiveLoaded] = useState<Partial<Record<AIProviderId, boolean>>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; latency?: number } | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [keys, setKeys] = useState<CredentialView[]>(savedKeys);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<"menu" | "account" | "api" | "server">("menu");
  const [oauthNotice, setOAuthNotice] = useState(oauthResult);
  const [deviceLogin, setDeviceLogin] = useState<{
    status: "waiting" | "connected" | "failed";
    verificationUrl?: string;
    userCode?: string;
    intervalSeconds?: number;
    error?: string;
  } | null>(null);

  // Rascunhos locais dos campos de texto: gravar a cada tecla escrevia o
  // localStorage e o cookie caractere por caractere e piscava o aviso de
  // "salvo". Agora o commit acontece ao sair do campo ou após uma pausa.
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);

  const currentConfig = AI_PROVIDERS[selectedProvider];
  // Sem cair no catálogo do código: vazio significa "ainda não escolhido".
  const activeModel = settings.defaultModels[selectedProvider] || "";
  const storedUrl = settings.customBaseUrls[selectedProvider] || "";
  // O campo NUNCA é pré-preenchido: a chave guardada não volta do servidor.
  // Vazio aqui significa "usar a que já está salva".
  const currentKey = keyDraft ?? "";
  const currentUrl = urlDraft ?? storedUrl;
  const savedKey = keys.find((k) => k.provider === selectedProvider);
  const supportsOAuth = selectedProvider === "openrouter" || selectedProvider === "gemini";

  // Só modelos vindos da API do usuário. O catálogo do código serve apenas
  // para dar nome e descrição a esses IDs, nunca como lista oferecida —
  // provedores aposentam modelos sem aviso e oferecer um ID morto dá 404.
  const models = useMemo(() => {
    const live = modelsMap[selectedProvider];
    if (live) return live;
    const saved = settings.customModels[selectedProvider];
    if (saved?.length) {
      return saved.map(
        (id) => currentConfig?.models.find((m) => m.id === id) ?? ({ id, name: id } as AIModelInfo)
      );
    }
    return [] as AIModelInfo[];
  }, [modelsMap, selectedProvider, currentConfig, settings.customModels]);

  // Assim que o localStorage é lido, o painel abre no provedor que está ativo.
  useEffect(() => {
    if (loaded) setSelectedProvider(oauthProvider || settings.activeProvider);
    // só na carga inicial: depois quem manda é o clique do usuário
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!connectionOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConnectionOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [connectionOpen]);

  useEffect(() => {
    if (!oauthResult) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth");
    url.searchParams.delete("provider");
    window.history.replaceState(window.history.state, "", url);
  }, [oauthResult]);

  useEffect(() => {
    if (!deviceLogin || deviceLogin.status !== "waiting" || selectedProvider !== "openai") return;
    let inFlight = false;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const response = await fetch("/api/ai/openai-device", { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível acompanhar a conexão.");
        setDeviceLogin((current) => ({ ...current, ...data }));
        if (data.status === "connected") {
          setKeys((prev) => [...prev.filter((key) => key.provider !== "openai"), {
            provider: "openai",
            hint: "ChatGPT",
            baseUrl: null,
            updatedAt: new Date(),
            broken: false,
            authType: "oauth",
          }]);
          setLiveLoaded((prev) => ({ ...prev, openai: false }));
          window.clearInterval(timer);
        }
      } catch (error) {
        if (cancelled) return;
        setDeviceLogin((current) => current ? { ...current, status: "failed", error: error instanceof Error ? error.message : "Falha ao acompanhar a conexão." } : current);
        window.clearInterval(timer);
      } finally {
        inFlight = false;
      }
    }, Math.max(3000, (deviceLogin.intervalSeconds || 5) * 1000));
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [deviceLogin?.status, deviceLogin?.intervalSeconds, selectedProvider]);

  const connectOAuth = async () => {
    setConnecting(true);
    setKeyError("");
    setOAuthNotice(undefined);
    try {
      const response = await fetch(`/api/ai/oauth/${selectedProvider}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || "Não foi possível iniciar a conexão.");
      window.location.assign(data.url);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
      setConnecting(false);
    }
  };

  const connectOpenAI = async () => {
    setConnecting(true);
    setKeyError("");
    setDeviceLogin(null);
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const response = await fetch("/api/ai/openai-device", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível iniciar a conexão.");
      setDeviceLogin(data);
      if (popup && typeof data.verificationUrl === "string") popup.location.href = data.verificationUrl;
    } catch (error) {
      popup?.close();
      setDeviceLogin({
        status: "failed",
        error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão.",
      });
    } finally {
      setConnecting(false);
    }
  };

  const commit = (patch: Partial<AISettingsData>) => {
    setSettings({ ...settings, ...patch });
    setSavedAt(Date.now());
  };

  /** Guarda a chave no servidor (cifrada) e limpa o campo. */
  const commitKey = async (value: string) => {
    const key = value.trim();
    if (!key) return;

    setKeyBusy(true);
    setKeyError("");
    const res = await saveApiKey(selectedProvider, key, currentUrl);
    setKeyBusy(false);

    if (!res.ok) {
      setKeyError(res.error);
      return;
    }
    // O rascunho é descartado assim que a chave sai daqui: nada de manter
    // uma cópia em claro no estado do React mais tempo que o necessário.
    setKeyDraft(null);
    setKeys((prev) => [
      ...prev.filter((k) => k.provider !== selectedProvider),
      {
        provider: selectedProvider,
        hint: res.hint,
        baseUrl: currentUrl || null,
        updatedAt: new Date(),
        broken: false,
        authType: "api-key",
      },
    ]);
    setSavedAt(Date.now());
    setLiveLoaded((prev) => ({ ...prev, [selectedProvider]: false }));
    setConnectionOpen(false);
  };

  const dropKey = async () => {
    setKeyBusy(true);
    setKeyError("");
    const isAgent = savedKey?.authType === "codex" || savedKey?.authType === "claude-code";
    const res = isAgent
      ? await fetch(`/api/ai/agent/${selectedProvider}`, { method: "DELETE" }).then(async (response) => ({ ok: response.ok, ...(await response.json()) }))
      : await removeApiKey(selectedProvider);
    setKeyBusy(false);
    if (!res.ok) {
      setKeyError(res.error);
      return;
    }
    setKeyDraft(null);
    setKeys((prev) => prev.filter((k) => k.provider !== selectedProvider));
    setLiveLoaded((prev) => ({ ...prev, [selectedProvider]: false }));
    setModelsMap((prev) => ({ ...prev, [selectedProvider]: undefined }));
    setSavedAt(Date.now());
  };

  const commitUrl = (value: string) => {
    setUrlDraft(null);
    if (value === storedUrl) return;
    commit({ customBaseUrls: { ...settings.customBaseUrls, [selectedProvider]: value } });
  };

  const selectModel = (modelId: string) => {
    const id = modelId.trim();
    if (!id) return;
    commit({ defaultModels: { ...settings.defaultModels, [selectedProvider]: id } });
  };

  const switchProvider = (id: AIProviderId) => {
    setKeyDraft(null);
    setUrlDraft(null);
    setSelectedProvider(id);
    setTestResult(null);
    setShowKey(false);
    setKeyError("");
    setDeviceLogin(null);
  };

  const openConnection = (id: AIProviderId) => {
    switchProvider(id);
    setConnectionMethod(id === "ollama" ? "server" : id === "openai" || id === "gemini" || id === "openrouter" ? "menu" : "api");
    setConnectionOpen(true);
  };

  const loadModels = async (opts: { silent?: boolean } = {}) => {
    setLoadingModels(true);
    if (!opts.silent) setTestResult(null);
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
      setLiveLoaded((prev) => ({ ...prev, [selectedProvider]: true }));

      // Persistido para o DeskHelper e o assistente de propostas oferecerem
      // exatamente os mesmos modelos, sem recorrer ao catálogo do código.
      const ids = (data.models as AIModelInfo[]).map((m) => m.id);

      // Versões antigas gravavam um modelo padrão para todo provedor. Se o que
      // está salvo não existe na conta, ele é descartado agora — senão o
      // "Testar conexão" continuaria chamando um modelo morto (era o caso do
      // gemini-2, que sobrou de uma configuração anterior).
      const saved = settings.defaultModels[selectedProvider];
      const nextDefaults = { ...settings.defaultModels };
      if (saved && !ids.includes(saved)) delete nextDefaults[selectedProvider];

      commit({
        customModels: { ...settings.customModels, [selectedProvider]: ids },
        defaultModels: nextDefaults,
      });
      if (!opts.silent) {
        setTestResult({ ok: true, msg: `${data.count} modelos carregados da sua conta.` });
      }
    } catch (err: any) {
      // Na carga automática o erro não vira alerta: a lista local segue valendo
      // e o usuário ainda não pediu nada explicitamente.
      if (!opts.silent) setTestResult({ ok: false, msg: err.message });
    } finally {
      setLoadingModels(false);
    }
  };

  /**
   * A lista fixa do código envelhece — provedores aposentam modelos sem aviso
   * (o gemini-2.0-flash, por exemplo, saiu do ar). Havendo chave, buscamos a
   * lista real da conta assim que o provedor é aberto, e o catálogo local passa
   * a ser só o plano B de quem ainda não configurou a chave.
   */
  useEffect(() => {
    if (!loaded) return;
    if (liveLoaded[selectedProvider]) return;
    const needsKey = currentConfig?.requiresApiKey;
    if (needsKey && !savedKey) return;

    const t = setTimeout(() => loadModels({ silent: true }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, selectedProvider, savedKey]);

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
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Provedores de IA</h2>
            <p className="text-xs text-slate-500">Cada pessoa conecta a própria conta ou chave, protegida e separada das demais.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Principal: <strong className="text-slate-900">{AI_PROVIDERS[settings.activeProvider]?.name}</strong>
            {justSaved && <span className="text-emerald-600">Salvo</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.values(AI_PROVIDERS).map((p) => {
            const isSelected = selectedProvider === p.id;
            const isDefault = settings.activeProvider === p.id;
            const hasKey = keys.some((k) => k.provider === p.id);

            return (
              <div
                key={p.id}
                className={`relative flex min-h-36 flex-col rounded-2xl border bg-white p-3 transition-all ${
                  isSelected
                    ? "accent-ring border-slate-400 shadow-md"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {isDefault && (
                  <span
                    className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-500"
                    title="Provedor ativo"
                  />
                )}
                <button type="button" onClick={() => switchProvider(p.id)} aria-pressed={isSelected} className="flex flex-1 flex-col items-start text-left">
                  <ProviderLogo provider={p.id} />
                  <span className="mt-3 w-full pr-3 text-sm font-bold leading-tight text-slate-900">{p.name}</span>
                  <span className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${hasKey ? "text-emerald-600" : "text-slate-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${hasKey ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {hasKey ? (keys.find((k) => k.provider === p.id)?.authType === "api-key" ? "Chave salva" : "Conta conectada") : "Não conectado"}
                  </span>
                </button>
                <button type="button" onClick={() => openConnection(p.id)} className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                  {hasKey ? "Gerenciar" : "Conectar"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Painel do provedor */}
      <section className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={selectedProvider} />
            <div>
              <h3 className="text-base font-bold text-slate-900">{currentConfig?.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {savedKey ? (savedKey.authType === "api-key" ? "Chave conectada" : "Conta conectada") : "Ainda não conectado"}
                {activeModel ? ` · ${activeModel}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openConnection(selectedProvider)} className="btn-secondary btn-sm">
              {savedKey ? "Gerenciar conexão" : "Conectar"}
            </button>
            <button
              type="button"
              onClick={() => commit({ activeProvider: selectedProvider })}
              disabled={settings.activeProvider === selectedProvider}
              className={settings.activeProvider === selectedProvider ? "btn btn-sm bg-emerald-600 text-white disabled:opacity-100" : "btn-secondary btn-sm"}
            >
              {settings.activeProvider === selectedProvider ? <><Icon name="check" size={13} /> Principal</> : "Usar como principal"}
            </button>
          </div>
        </div>

        {oauthNotice && (
          <Alert tone={oauthNotice === "success" ? "success" : "neutral"} size="sm">
            {oauthNotice === "success"
              ? "Conta conectada. Carregue os modelos, escolha um e use Definir como principal se quiser ativar este provedor."
              : oauthNotice === "cancelled"
                ? "Autorização cancelada. A conexão anterior foi mantida."
                : "Não foi possível concluir a autorização. Sua sessão ou o código pode ter expirado. Tente conectar novamente."}
          </Alert>
        )}

        <div>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900">Modelos</h3>
            <p className="text-xs text-slate-500">Mostramos somente os modelos liberados para sua conexão.</p>
          </div>
        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => loadModels()}
            disabled={loadingModels}
            className="btn-secondary btn-sm"
          >
            {loadingModels ? "Carregando…" : "Recarregar modelos da minha conta"}
          </button>

          <button
            type="button"
            onClick={testConnection}
            disabled={testing || !activeModel}
            title={!activeModel ? "Escolha um modelo da lista abaixo primeiro" : undefined}
            className="btn-primary btn-sm"
          >
            {testing ? "Testando…" : "Testar conexão"}
          </button>

          {/* Saída manual para configuração antiga que ficou presa no
              navegador — inclusive modelos que não existem mais. */}
          {(activeModel || models.length > 0 || savedKey) && (
            <button
              type="button"
              onClick={() => {
                const defaults = { ...settings.defaultModels };
                const custom = { ...settings.customModels };
                delete defaults[selectedProvider];
                delete custom[selectedProvider];
                setModelsMap((prev) => ({ ...prev, [selectedProvider]: undefined }));
                setLiveLoaded((prev) => ({ ...prev, [selectedProvider]: false }));
                setTestResult(null);
                commit({ defaultModels: defaults, customModels: custom });
              }}
              className="btn-secondary btn-sm ml-auto"
            >
              Limpar este provedor
            </button>
          )}
        </div>

        {testResult && (
          <div
            role="status"
            className={`alert-surface flex items-start justify-between gap-3 rounded-xl p-3 text-xs text-slate-700 animate-fade-in ${
              testResult.ok ? "alert-success" : "alert-danger"
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
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Modelos da sua conta{models.length > 0 ? ` (${models.length})` : ""}
            </h4>
            {models.length > 0 && (
              <span className="text-xs text-slate-500">Clique para definir como padrão</span>
            )}
          </div>

          {/* Nada de lista fixa: mostrar modelos que talvez não existam na conta
              do usuário só produz erro 404 na hora de usar. */}
          {models.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm font-medium text-slate-700">
                Nenhum modelo carregado ainda
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {currentConfig?.requiresApiKey && !savedKey
                  ? "Conecte sua conta por OAuth, quando disponível, ou salve uma chave de API para carregar os modelos."
                  : "Use o botão acima para buscar na API do provedor exatamente os modelos que a sua chave pode usar."}
              </p>
            </div>
          )}

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
                      ? "accent-selected accent-ring"
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

        </div>
        </div>
      </section>

      {connectionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setConnectionOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-connect-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <ProviderLogo provider={selectedProvider} />
                <div>
                  <h3 id="ai-connect-title" className="text-base font-bold text-slate-900">Conectar {currentConfig.name}</h3>
                  <p className="text-xs text-slate-500">A credencial será somente da sua conta.</p>
                </div>
              </div>
              <button type="button" onClick={() => setConnectionOpen(false)} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {connectionMethod === "menu" && (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-slate-600">Escolha uma forma de conexão:</p>
                  <button type="button" onClick={() => setConnectionMethod("account")} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        {selectedProvider === "openai" ? "ChatGPT Pro/Plus" : selectedProvider === "gemini" ? "Conta Google" : "Conta OpenRouter"}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">Conectar pelo navegador</span>
                    </span>
                    <Icon name="chevronRight" size={18} />
                  </button>
                  <button type="button" onClick={() => setConnectionMethod("api")} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-bold text-slate-900">Chave de API</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Colar uma chave individual</span>
                    </span>
                    <Icon name="chevronRight" size={18} />
                  </button>
                </div>
              )}

              {connectionMethod === "account" && (
                <div className="space-y-4">
                  <button type="button" onClick={() => setConnectionMethod("menu")} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
                    <Icon name="chevronLeft" size={14} /> Voltar
                  </button>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedProvider === "openai" ? "Entrar com ChatGPT" : selectedProvider === "gemini" ? "Entrar com Google" : "Entrar com OpenRouter"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {selectedProvider === "openai"
                        ? "O navegador abrirá a página oficial da OpenAI. Informe o código exibido aqui; não é necessário instalar o Codex no servidor."
                        : selectedProvider === "gemini"
                          ? "O Google solicitará acesso ao projeto de IA configurado para esta integração."
                          : "O OpenRouter criará uma credencial delegada para esta conta."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={selectedProvider === "openai" ? connectOpenAI : connectOAuth}
                    disabled={connecting || keyBusy || !canStore || (selectedProvider === "openai" ? !oauthAvailable.openai || deviceLogin?.status === "waiting" : !oauthAvailable[selectedProvider as "gemini" | "openrouter"])}
                    className="btn-primary w-full justify-center"
                  >
                    {connecting ? "Abrindo…" : savedKey?.authType === "oauth" ? "Reconectar conta" : "Continuar no navegador"}
                  </button>

                  {deviceLogin?.status === "waiting" && selectedProvider === "openai" && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                      <p className="text-xs text-blue-700">Código de dispositivo</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <code className="rounded-lg bg-white px-3 py-2 text-lg font-bold tracking-widest">{deviceLogin.userCode}</code>
                        {deviceLogin.verificationUrl && <a className="text-xs font-semibold underline" href={deviceLogin.verificationUrl} target="_blank" rel="noreferrer">Abrir OpenAI</a>}
                      </div>
                      <p className="mt-2 text-xs text-blue-700">Aguardando a confirmação…</p>
                    </div>
                  )}
                  {deviceLogin?.status === "connected" && selectedProvider === "openai" && <Alert tone="success" size="sm">Conta conectada. Feche esta janela e carregue os modelos.</Alert>}
                  {deviceLogin?.status === "failed" && selectedProvider === "openai" && deviceLogin.error && <Alert tone="danger" size="sm">{deviceLogin.error}</Alert>}
                  {!canStore && <Alert tone="neutral" size="sm">O armazenamento seguro de credenciais precisa ser habilitado pelo administrador.</Alert>}
                  {canStore && !oauthAvailable[selectedProvider as "openai" | "gemini" | "openrouter"] && <Alert tone="neutral" size="sm">O login por conta está indisponível nesta instalação. Você pode voltar e conectar com sua chave de API.</Alert>}
                </div>
              )}

              {connectionMethod === "api" && (
                <div className="space-y-4">
                  {(selectedProvider === "openai" || supportsOAuth) && (
                    <button type="button" onClick={() => setConnectionMethod("menu")} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
                      <Icon name="chevronLeft" size={14} /> Voltar
                    </button>
                  )}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="ai-key-modal" className="label mb-0 text-xs">Chave de API ({currentConfig.keyEnvVar})</label>
                      <button type="button" onClick={() => setShowKey(!showKey)} className="text-xs text-slate-500 hover:text-slate-900">{showKey ? "Ocultar" : "Mostrar"}</button>
                    </div>
                    <input
                      id="ai-key-modal"
                      type="text"
                      name="drr-ai-provider-key-modal"
                      autoComplete="off"
                      spellCheck={false}
                      data-1p-ignore
                      data-lpignore="true"
                      data-bwignore
                      data-form-type="other"
                      value={currentKey}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      disabled={keyBusy || !canStore}
                      placeholder={savedKey ? "Cole uma chave nova para substituir" : `Cole sua ${currentConfig.keyEnvVar}`}
                      className={`input text-xs ${showKey ? "font-mono" : "input-secret"}`}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">A chave é cifrada e vinculada somente ao seu usuário.</p>
                  </div>

                  <details className="rounded-xl border border-slate-200 px-3 py-2.5">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">Configuração avançada</summary>
                    <div className="mt-3">
                      <label htmlFor="ai-url-modal" className="label mb-1 text-xs">URL base da API</label>
                      <input id="ai-url-modal" type="text" spellCheck={false} value={currentUrl} onChange={(event) => setUrlDraft(event.target.value)} onBlur={(event) => commitUrl(event.target.value)} placeholder={currentConfig.defaultBaseUrl || "https://api.openai.com"} className="input text-xs font-mono" />
                      <p className="mt-1 text-xs text-slate-500">Deixe vazio para usar o endereço oficial.</p>
                    </div>
                  </details>

                  {keyError && <Alert tone="danger" size="sm">{keyError}</Alert>}
                  {!canStore && <Alert tone="neutral" size="sm">O armazenamento seguro de credenciais precisa ser habilitado pelo administrador.</Alert>}
                  <button type="button" onClick={() => commitKey(currentKey)} disabled={!currentKey.trim() || keyBusy || !canStore} className="btn-primary w-full justify-center">
                    {keyBusy ? "Salvando…" : savedKey ? "Substituir chave" : "Salvar chave"}
                  </button>
                </div>
              )}

              {connectionMethod === "server" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ai-server-url" className="label mb-1 text-xs">Endereço do Ollama</label>
                    <input id="ai-server-url" type="text" spellCheck={false} value={currentUrl} onChange={(event) => setUrlDraft(event.target.value)} placeholder={currentConfig.defaultBaseUrl} className="input text-xs font-mono" />
                    <p className="mt-1.5 text-xs text-slate-500">Use o endereço do Ollama acessível pelo servidor do ERP.</p>
                  </div>
                  <button type="button" onClick={() => { commitUrl(currentUrl); setConnectionOpen(false); }} className="btn-primary w-full justify-center">Salvar endereço</button>
                </div>
              )}

              {savedKey && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Conexão atual ativa</span>
                  <button type="button" onClick={dropKey} disabled={keyBusy} className="font-semibold text-red-600 hover:underline">{savedKey.authType === "api-key" ? "Remover chave" : "Desconectar"}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderLogo({ provider }: { provider: AIProviderId }) {
  const logos: Record<AIProviderId, string | null> = {
    openai: "openai", anthropic: "claude-color", gemini: "gemini-color",
    deepseek: "deepseek-color", groq: "groq", mistral: "mistral-color",
    xai: "grok", cohere: "cohere-color", openrouter: "openrouter",
    ollama: "ollama", custom: null,
  };
  const logo = logos[provider];
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] p-2 shadow-sm ring-1 ring-black/10">
      {logo ? (
        // Local SVG brand assets; no third-party image requests.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/ai-logos/${logo}.svg`} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
      ) : (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#475569" strokeWidth="1.8"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" /></svg>
      )}
    </span>
  );
}
