"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { AIModelInfo, AIProviderId, AISettingsData } from "@/lib/ai/types";
import { useAISettings } from "../components/useAISettings";
import { Icon } from "../components/icons";
import { saveApiKey, removeApiKey } from "./ai-key-actions";
import type { CredentialView } from "@/lib/ai/credentials";

export default function AISettings({
  initialSettings,
  savedKeys = [],
  canStore = true,
  isAdmin = false,
}: {
  initialSettings?: AISettingsData;
  /**
   * Chaves já guardadas, vindas do servidor — SEM a chave em si, só a dica
   * dos últimos caracteres. É o suficiente para a pessoa reconhecer qual
   * está salva, e nada além disso chega ao navegador.
   */
  savedKeys?: CredentialView[];
  /** O servidor tem segredo de criptografia configurado? */
  canStore?: boolean;
  /** Só administrador mexe no .env do servidor; para os demais isso é ruído. */
  isAdmin?: boolean;
}) {
  const { settings, setSettings, loaded } = useAISettings();
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(
    initialSettings?.activeProvider || "gemini"
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

  // Rascunhos locais dos campos de texto: gravar a cada tecla escrevia o
  // localStorage e o cookie caractere por caractere e piscava o aviso de
  // "salvo". Agora o commit acontece ao sair do campo ou após uma pausa.
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentConfig = AI_PROVIDERS[selectedProvider];
  // Sem cair no catálogo do código: vazio significa "ainda não escolhido".
  const activeModel = settings.defaultModels[selectedProvider] || "";
  const storedUrl = settings.customBaseUrls[selectedProvider] || "";
  // O campo NUNCA é pré-preenchido: a chave guardada não volta do servidor.
  // Vazio aqui significa "usar a que já está salva".
  const currentKey = keyDraft ?? "";
  const currentUrl = urlDraft ?? storedUrl;
  const savedKey = keys.find((k) => k.provider === selectedProvider);

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
      },
    ]);
    setSavedAt(Date.now());
  };

  const dropKey = async () => {
    setKeyBusy(true);
    setKeyError("");
    const res = await removeApiKey(selectedProvider);
    setKeyBusy(false);
    if (!res.ok) {
      setKeyError(res.error);
      return;
    }
    setKeyDraft(null);
    setKeys((prev) => prev.filter((k) => k.provider !== selectedProvider));
    setSavedAt(Date.now());
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
              {settings.defaultModels[settings.activeProvider] || "nenhum modelo escolhido"}
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
        A chave fica salva <strong>somente neste navegador</strong> e vai ao servidor apenas no
        momento de cada consulta — nunca em cookie. Ela vale só para a sua conta: quem entrar
        com outro usuário nesta máquina não usa a sua chave.
        {isAdmin && (
          <>
            {" "}
            Para uma chave única da equipe, defina a variável de ambiente no servidor e deixe o
            campo em branco.
          </>
        )}
      </p>

      {/* Grade de provedores */}
      <div>
        <label className="label mb-2 font-medium">Provedor a configurar</label>
        <p className="mb-2 text-xs text-slate-500">
          Dá para deixar vários configurados e trocar na hora, pelo seletor dentro do DeskHelper AI.
          O marcado como principal é o que o ERP usa por padrão.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {Object.values(AI_PROVIDERS).map((p) => {
            const isSelected = selectedProvider === p.id;
            const isDefault = settings.activeProvider === p.id;
            const hasKey = keys.some((k) => k.provider === p.id);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => switchProvider(p.id)}
                aria-pressed={isSelected}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "accent-selected accent-ring shadow-md"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                {isDefault && (
                  <span
                    className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-500"
                    title="Provedor ativo"
                  />
                )}
                {/* Nome inteiro. Quebrar no primeiro espaço produzia rótulos
                    sem sentido: "Servidor / próprio", "Mistral / AI". */}
                <span className="w-full pr-3 text-sm font-bold text-slate-900 leading-tight">
                  {p.name}
                </span>
                <span className="mt-1 w-full text-xs text-slate-500 leading-snug line-clamp-2">
                  {p.tagline}
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
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-xs text-slate-500 underline hover:text-slate-800"
                >
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
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
                onChange={(e) => setKeyDraft(e.target.value)}
                disabled={keyBusy || !canStore}
                placeholder={
                  savedKey
                    ? "Cole uma chave nova para substituir a atual"
                    : `Cole sua ${currentConfig.keyEnvVar}`
                }
                className={`input text-xs ${showKey ? "font-mono" : "input-secret"}`}
              />

              {/* Salvar é um clique explícito, não um debounce. A chave sai do
                  navegador para o servidor uma única vez, no momento em que a
                  pessoa manda — não a cada tecla digitada. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => commitKey(currentKey)}
                  disabled={!currentKey.trim() || keyBusy || !canStore}
                  className="btn-primary btn-sm"
                >
                  {keyBusy ? "Salvando..." : savedKey ? "Substituir chave" : "Salvar chave"}
                </button>

                {savedKey && (
                  <>
                    <span className="font-mono text-xs text-slate-500">
                      salva: ••••{savedKey.hint}
                    </span>
                    <button
                      type="button"
                      onClick={dropKey}
                      disabled={keyBusy}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </>
                )}
              </div>

              {savedKey?.broken && (
                <p className="mt-2 text-xs text-amber-600">
                  A chave está guardada mas o servidor não consegue mais lê-la —
                  o segredo de criptografia mudou. Cadastre a chave de novo.
                </p>
              )}
              {keyError && <p className="mt-2 text-xs text-red-600">{keyError}</p>}
              {!canStore && (
                <p className="mt-2 text-xs text-amber-600">
                  O servidor não tem <code className="font-mono">AI_ENCRYPTION_KEY</code>{" "}
                  configurada. Sem ela a chave só poderia ser guardada em claro,
                  então o cadastro fica bloqueado.
                </p>
              )}
              {currentKey && !/^(sk-|gsk_|xai-|csk-|AIza|co-|or-|[A-Za-z0-9_-]{24,})/.test(currentKey.trim()) && (
                <p className="mt-1 text-xs text-amber-600">
                  Isto não parece uma chave de API. Se o navegador preencheu o campo
                  com uma senha salva, clique em Remover.
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {isAdmin
                  ? "Já definida no .env do servidor? Deixe em branco e ela será usada."
                  : "Deixe em branco se a empresa já fornece uma chave configurada no servidor."}
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
              Deixe em branco para usar o endereço oficial do provedor. Padrão:{" "}
              <code className="font-mono">{currentConfig?.defaultBaseUrl || "padrão do serviço"}</code>
            </p>
          </div>
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
        <div className="space-y-3 pt-1">
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
                  ? "Informe a chave de API acima. Assim que ela for salva, a lista é buscada automaticamente na sua conta."
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
    </div>
  );
}
