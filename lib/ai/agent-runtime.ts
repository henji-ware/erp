import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { chmod, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import type { AICompletionResult, AIMessage, AIProviderId } from "./types";
import { deleteCredential, saveAgentCredential } from "./credentials";
import { agentRuntimeCapability, requireAgentRuntime } from "./agent-capability";

type AgentProvider = "openai" | "anthropic";
type LoginStatus = "starting" | "waiting" | "connected" | "failed";

export interface AgentLoginView {
  provider: AgentProvider;
  available: boolean;
  status: LoginStatus;
  verificationUrl?: string;
  userCode?: string;
  output?: string;
  error?: string;
}

interface LoginState extends AgentLoginView {
  process?: ChildProcessWithoutNullStreams;
  close?: () => void;
  createdAt: number;
}

interface RpcMessage {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: { message?: string };
}

const LOGIN_TTL_MS = 10 * 60_000;
const COMMAND_TIMEOUT_MS = 120_000;
const MAX_OUTPUT = 12_000;

const globalAgentState = globalThis as typeof globalThis & {
  __drrAgentLogins?: Map<string, LoginState>;
};
const logins = globalAgentState.__drrAgentLogins ??= new Map<string, LoginState>();

function stateKey(userId: number, provider: AgentProvider) {
  return `${userId}:${provider}`;
}

function command(provider: AgentProvider): string {
  return provider === "openai"
    ? process.env.CODEX_BIN?.trim() || "codex"
    : process.env.CLAUDE_BIN?.trim() || "claude";
}

function dataRoot(): string {
  return path.resolve(process.env.AI_AGENT_DATA_DIR?.trim() || path.join(process.cwd(), ".data", "ai-agent-auth"));
}

async function userDir(userId: number, provider: AgentProvider): Promise<string> {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Usuário inválido.");
  const dir = path.join(dataRoot(), `user-${userId}`, provider === "openai" ? "codex" : "claude");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700).catch(() => undefined);
  return dir;
}

/** Não entrega segredos do processo Next.js ao agente filho. */
function safeEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const names = [
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "COMSPEC",
    "TEMP", "TMP", "TMPDIR", "USERPROFILE", "LOCALAPPDATA", "APPDATA",
    "LANG", "LC_ALL", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
    "SSL_CERT_FILE", "CODEX_CA_CERTIFICATE",
  ];
  const env = { NODE_ENV: process.env.NODE_ENV || "production" } as NodeJS.ProcessEnv;
  for (const name of names) if (process.env[name] !== undefined) env[name] = process.env[name];
  return { ...env, ...extra };
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "").replace(/\r/g, "");
}

function appendOutput(state: LoginState, chunk: Buffer | string) {
  state.output = stripAnsi(`${state.output || ""}${chunk}`).slice(-MAX_OUTPUT);
  const match = state.output.match(/https?:\/\/[^\s<>'"\])]+/i);
  if (match) state.verificationUrl = match[0];
}

function publicState(state: LoginState): AgentLoginView {
  const { process: _process, close: _close, createdAt: _createdAt, ...view } = state;
  return view;
}

class CodexRpc {
  private readonly home: string;
  private proc?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private listeners = new Set<(message: RpcMessage) => void>();
  private stderr = "";

  constructor(home: string) {
    this.home = home;
  }

  async start() {
    const proc = spawn(command("openai"), ["app-server", "--listen", "stdio://"], {
      cwd: this.home,
      env: safeEnv({ CODEX_HOME: this.home }),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.proc = proc;
    proc.stderr.on("data", (chunk) => { this.stderr = `${this.stderr}${stripAnsi(String(chunk))}`.slice(-4000); });
    proc.on("error", (error) => this.failAll(error));
    proc.on("close", () => this.failAll(new Error(this.stderr || "O processo Codex foi encerrado.")));
    const lines = readline.createInterface({ input: proc.stdout });
    lines.on("line", (line) => {
      let message: RpcMessage;
      try { message = JSON.parse(line); } catch { return; }
      if (typeof message.id === "number" && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)!;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || "Erro no Codex App Server."));
        else pending.resolve(message.result);
      } else {
        for (const listener of this.listeners) listener(message);
      }
    });
    await this.request("initialize", {
      clientInfo: { name: "drr_erp", title: "DRR ERP", version: "0.7.0" },
    });
    this.send({ method: "initialized", params: {} });
  }

  request(method: string, params: unknown = {}, timeoutMs = 30_000): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`O Codex não respondeu a ${method} dentro do prazo.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ method, id, params });
    });
  }

  onNotification(listener: (message: RpcMessage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  waitFor(method: string, predicate: (params: any) => boolean = () => true, timeoutMs = COMMAND_TIMEOUT_MS): Promise<any> {
    return new Promise((resolve, reject) => {
      const off = this.onNotification((message) => {
        if (message.method === method && predicate(message.params)) {
          clearTimeout(timer);
          off();
          resolve(message.params);
        }
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`O Codex não concluiu ${method} dentro do prazo.`));
      }, timeoutMs);
    });
  }

  close() {
    this.proc?.kill();
    this.proc = undefined;
  }

  private send(message: unknown) {
    if (!this.proc?.stdin.writable) throw new Error("O Codex App Server não está disponível.");
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private failAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function codexClient(userId: number) {
  requireAgentRuntime();
  const rpc = new CodexRpc(await userDir(userId, "openai"));
  await rpc.start();
  return rpc;
}

function expireLogin(key: string, state: LoginState) {
  setTimeout(() => {
    if (logins.get(key) !== state || state.status === "connected") return;
    state.close?.();
    state.status = "failed";
    state.error = "A autorização expirou. Inicie novamente.";
  }, LOGIN_TTL_MS).unref?.();
}

async function startCodexLogin(userId: number): Promise<AgentLoginView> {
  const key = stateKey(userId, "openai");
  const existing = logins.get(key);
  if (existing && Date.now() - existing.createdAt < LOGIN_TTL_MS && existing.status !== "failed") return publicState(existing);

  const state: LoginState = { provider: "openai", available: true, status: "starting", createdAt: Date.now() };
  logins.set(key, state);
  try {
    const rpc = await codexClient(userId);
    state.close = () => rpc.close();
    const result = await rpc.request("account/login/start", { type: "chatgptDeviceCode" });
    state.status = "waiting";
    state.verificationUrl = result?.verificationUrl;
    state.userCode = result?.userCode;
    const loginId = result?.loginId;
    const off = rpc.onNotification((message) => {
      if (message.method !== "account/login/completed" || message.params?.loginId !== loginId) return;
      off();
      if (message.params?.success) {
        state.error = undefined;
        void saveAgentCredential(userId, "openai", "codex").then(() => {
          state.status = "connected";
        }).catch((error) => {
          state.status = "failed";
          state.error = error instanceof Error ? error.message : "Não foi possível guardar a conexão.";
        }).finally(() => rpc.close());
      } else {
        state.status = "failed";
        state.error = message.params?.error || "A OpenAI não concluiu a autorização.";
        rpc.close();
      }
    });
    expireLogin(key, state);
  } catch (error) {
    state.available = !/ENOENT|not found|não.*encontr/i.test(String(error));
    state.status = "failed";
    state.error = error instanceof Error ? error.message : "Não foi possível iniciar o Codex.";
    state.close?.();
  }
  return publicState(state);
}

async function runCommand(binary: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv; input?: string; timeoutMs?: number }): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: opts.cwd, env: opts.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-200_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-20_000); });
    child.on("error", reject);
    const timer = setTimeout(() => { child.kill(); reject(new Error("O comando de IA excedeu o tempo limite.")); }, opts.timeoutMs || 15_000);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout: stripAnsi(stdout), stderr: stripAnsi(stderr) }); });
    if (opts.input !== undefined) child.stdin.end(opts.input); else child.stdin.end();
  });
}

async function claudeIsAuthenticated(userId: number): Promise<boolean> {
  requireAgentRuntime();
  const dir = await userDir(userId, "anthropic");
  const result = await runCommand(command("anthropic"), ["auth", "status", "--json"], {
    cwd: dir,
    env: safeEnv({ CLAUDE_CONFIG_DIR: dir }),
  });
  return result.code === 0 && !/not logged|false/i.test(result.stdout);
}

async function startClaudeLogin(userId: number): Promise<AgentLoginView> {
  requireAgentRuntime();
  const key = stateKey(userId, "anthropic");
  const existing = logins.get(key);
  if (existing && Date.now() - existing.createdAt < LOGIN_TTL_MS && existing.status !== "failed") return publicState(existing);
  const dir = await userDir(userId, "anthropic");
  const state: LoginState = { provider: "anthropic", available: true, status: "waiting", createdAt: Date.now(), output: "" };
  logins.set(key, state);
  try {
    const child = spawn(command("anthropic"), ["auth", "login"], {
      cwd: dir,
      env: safeEnv({ CLAUDE_CONFIG_DIR: dir }),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    state.process = child;
    state.close = () => child.kill();
    child.stdout.on("data", (chunk) => appendOutput(state, chunk));
    child.stderr.on("data", (chunk) => appendOutput(state, chunk));
    child.on("error", (error) => {
      state.available = !/ENOENT|not found|não.*encontr/i.test(String(error));
      state.status = "failed";
      state.error = error.message;
    });
    child.on("close", () => {
      void claudeIsAuthenticated(userId).then(async (connected) => {
        if (connected) {
          await saveAgentCredential(userId, "anthropic", "claude-code");
          state.status = "connected";
        } else {
          state.status = "failed";
          state.error ||= "O Claude Code encerrou sem conectar a conta.";
        }
      }).catch((error) => {
        state.status = "failed";
        state.error = error instanceof Error ? error.message : "Não foi possível confirmar a conexão.";
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expireLogin(key, state);
  } catch (error) {
    state.available = false;
    state.status = "failed";
    state.error = error instanceof Error ? error.message : "Claude Code não está disponível.";
  }
  return publicState(state);
}

export async function startAgentLogin(userId: number, provider: AgentProvider): Promise<AgentLoginView> {
  requireAgentRuntime();
  return provider === "openai" ? startCodexLogin(userId) : startClaudeLogin(userId);
}

export function submitAgentLogin(userId: number, provider: AgentProvider, value: string): AgentLoginView {
  requireAgentRuntime();
  const state = logins.get(stateKey(userId, provider));
  if (!state || state.status !== "waiting") throw new Error("Não há autorização aguardando confirmação.");
  if (provider !== "anthropic" || !state.process?.stdin.writable) throw new Error("Este login não aceita entrada manual.");
  const clean = value.trim();
  if (!clean || clean.length > 2000 || /[\r\n]/.test(clean)) throw new Error("Código de autorização inválido.");
  state.process.stdin.write(`${clean}\n`);
  return publicState(state);
}

export async function readAgentLogin(userId: number, provider: AgentProvider): Promise<AgentLoginView> {
  const capability = agentRuntimeCapability();
  if (!capability.available) {
    return { provider, available: false, status: "failed", error: capability.reason };
  }
  const state = logins.get(stateKey(userId, provider));
  if (state) return publicState(state);
  try {
    if (provider === "openai") {
      const rpc = await codexClient(userId);
      try {
        const account = await rpc.request("account/read", { refreshToken: false });
        const connected = Boolean(account?.account);
        if (connected) await saveAgentCredential(userId, "openai", "codex");
        return { provider, available: true, status: connected ? "connected" : "failed" };
      } finally { rpc.close(); }
    }
    const connected = await claudeIsAuthenticated(userId);
    if (connected) await saveAgentCredential(userId, "anthropic", "claude-code");
    return { provider, available: true, status: connected ? "connected" : "failed" };
  } catch (error) {
    return { provider, available: false, status: "failed", error: `${provider === "openai" ? "Codex" : "Claude Code"} não está instalado ou não pôde ser iniciado no servidor.` };
  }
}

export async function disconnectAgent(userId: number, provider: AgentProvider): Promise<void> {
  const key = stateKey(userId, provider);
  logins.get(key)?.close?.();
  logins.delete(key);
  if (!agentRuntimeCapability().available) {
    await deleteCredential(userId, provider);
    return;
  }
  const dir = await userDir(userId, provider);
  try {
    if (provider === "openai") {
      const rpc = await codexClient(userId);
      try { await rpc.request("account/logout"); } finally { rpc.close(); }
    } else {
      await runCommand(command(provider), ["auth", "logout"], { cwd: dir, env: safeEnv({ CLAUDE_CONFIG_DIR: dir }) });
    }
  } finally {
    await deleteCredential(userId, provider);
    const root = dataRoot();
    const resolved = path.resolve(dir);
    if (resolved.startsWith(`${root}${path.sep}`)) await rm(resolved, { recursive: true, force: true });
  }
}

export async function listAgentModels(userId: number, provider: AgentProvider) {
  requireAgentRuntime();
  if (provider === "openai") {
    const rpc = await codexClient(userId);
    try {
      const result = await rpc.request("model/list", { limit: 100, includeHidden: false });
      return (result?.data || []).map((model: any) => ({
        id: String(model.model || model.id),
        name: String(model.displayName || model.model || model.id),
        description: "Modelo disponível na sua conta ChatGPT pelo Codex.",
        tier: "flagship" as const,
      }));
    } finally { rpc.close(); }
  }
  // O Claude Code aceita aliases e IDs no --model, mas não oferece um catálogo
  // estável via CLI. Mantemos os IDs conhecidos no catálogo local.
  const { AI_PROVIDERS } = await import("./providers");
  return AI_PROVIDERS.anthropic.models;
}

function promptFromMessages(messages: AIMessage[]): string {
  return messages.map((message) => `${message.role === "assistant" ? "Assistente" : "Usuário"}: ${message.content}`).join("\n\n");
}

export async function runAgentCompletion(options: {
  provider: AIProviderId;
  userId: number;
  model: string;
  messages: AIMessage[];
  systemPrompt?: string;
  signal?: AbortSignal;
}): Promise<AICompletionResult> {
  requireAgentRuntime();
  const started = Date.now();
  if (options.provider === "openai") {
    const rpc = await codexClient(options.userId);
    const onAbort = () => rpc.close();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const thread = await rpc.request("thread/start", {
        model: options.model,
        cwd: await userDir(options.userId, "openai"),
        approvalPolicy: "never",
        sandbox: "read-only",
        developerInstructions: options.systemPrompt || "Responda em português do Brasil, de forma objetiva.",
        ephemeral: true,
        serviceName: "drr_erp",
      });
      const threadId = thread?.thread?.id;
      if (!threadId) throw new Error("O Codex não criou a conversa.");
      let finalText = "";
      const off = rpc.onNotification((message) => {
        if (message.method === "item/completed" && message.params?.threadId === threadId) {
          const item = message.params?.item;
          if (item?.type === "agentMessage" && item?.phase !== "commentary") finalText = item.text || finalText;
        }
      });
      const completed = rpc.waitFor("turn/completed", (params) => params?.threadId === threadId);
      await rpc.request("turn/start", {
        threadId,
        input: [{ type: "text", text: promptFromMessages(options.messages) }],
      });
      const result = await completed;
      off();
      if (result?.turn?.status === "failed") throw new Error(result?.turn?.error?.message || "O Codex não concluiu a resposta.");
      if (!finalText.trim()) throw new Error("O Codex encerrou sem produzir uma resposta.");
      return { text: finalText, provider: "openai", model: options.model, latencyMs: Date.now() - started };
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
      rpc.close();
    }
  }

  if (options.provider !== "anthropic") throw new Error("Agente incompatível com o provedor.");
  const dir = await userDir(options.userId, "anthropic");
  const args = [
    "-p", "--output-format", "json", "--model", options.model,
    "--tools", "", "--no-session-persistence",
    "--system-prompt", options.systemPrompt || "Responda em português do Brasil, de forma objetiva.",
  ];
  const result = await runCommand(command("anthropic"), args, {
    cwd: dir,
    env: safeEnv({ CLAUDE_CONFIG_DIR: dir }),
    input: promptFromMessages(options.messages),
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  if (result.code !== 0) throw new Error(result.stderr || "O Claude Code não concluiu a resposta.");
  let data: any;
  try { data = JSON.parse(result.stdout); } catch { data = { result: result.stdout }; }
  const text = typeof data.result === "string" ? data.result : typeof data.text === "string" ? data.text : "";
  if (!text.trim()) throw new Error("O Claude Code encerrou sem produzir uma resposta.");
  return { text, provider: "anthropic", model: options.model, latencyMs: Date.now() - started };
}

export function isAgentProvider(value: unknown): value is AgentProvider {
  return value === "openai" || value === "anthropic";
}
