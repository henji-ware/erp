import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  OPENAI_CODEX_BASE_URL,
  OPENAI_DEVICE_VERIFICATION_URL,
  pollOpenAIDeviceOAuth,
  refreshOpenAICredential,
  startOpenAIDeviceOAuth,
} from "../lib/ai/openai-device-oauth.ts";
import { executeAICompletion, resolveCall, streamAICompletion } from "../lib/ai/client.ts";

const originalEnv = { ...process.env };
beforeEach(() => {
  process.env.AI_ENCRYPTION_KEY = "openai-device-test-only-master-secret";
});
afterEach(() => { process.env = { ...originalEnv }; });

function jwt(payload: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("inicia o código de dispositivo sem devolver segredo ao navegador", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://auth.openai.com/api/accounts/deviceauth/usercode");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body as string), { client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
    return Response.json({ device_auth_id: "device-test", user_code: "ABCD-EFGH", interval: "5" });
  });
  const flow = await startOpenAIDeviceOAuth(7, "session-seven");
  assert.equal(flow.verificationUrl, OPENAI_DEVICE_VERIFICATION_URL);
  assert.equal(flow.userCode, "ABCD-EFGH");
  assert.equal(flow.intervalSeconds, 5);
  assert.ok(!flow.cookie.includes("device-test"));
  assert.ok(!JSON.stringify(flow).includes("app_EMoamEEZ73f0CkXaXp7hrann"));
});

test("poll pendente preserva o fluxo e exige o mesmo usuário e sessão", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    if (url.endsWith("/usercode")) return Response.json({ device_auth_id: "device-test", user_code: "ABCD-EFGH", interval: 3 });
    return new Response(null, { status: 403 });
  });
  const flow = await startOpenAIDeviceOAuth(7, "session-seven", 1000);
  assert.deepEqual(await pollOpenAIDeviceOAuth(flow.cookie, 7, "session-seven", 2000), { status: "waiting", intervalSeconds: 3 });
  await assert.rejects(pollOpenAIDeviceOAuth(flow.cookie, 8, "session-seven", 2000), /expirou/);
  await assert.rejects(pollOpenAIDeviceOAuth(flow.cookie, 7, "other-session", 2000), /expirou/);
  await assert.rejects(pollOpenAIDeviceOAuth(flow.cookie, 7, "session-seven", 901_000), /expirou/);
  assert.equal(calls, 2);
});

test("conclui device auth, troca o código no servidor e extrai a conta ChatGPT", async (t) => {
  const accountId = "account_123";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls++;
    if (url.endsWith("/usercode")) return Response.json({ device_auth_id: "device-test", user_code: "ABCD-EFGH", interval: 5 });
    if (url.endsWith("/deviceauth/token")) {
      assert.deepEqual(JSON.parse(init.body as string), { device_auth_id: "device-test", user_code: "ABCD-EFGH" });
      return Response.json({ authorization_code: "authorization-code", code_verifier: "verifier-test" });
    }
    assert.equal(url, "https://auth.openai.com/oauth/token");
    const body = new URLSearchParams(init.body as string);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("redirect_uri"), "https://auth.openai.com/deviceauth/callback");
    assert.equal(body.get("code_verifier"), "verifier-test");
    return Response.json({ access_token: jwt({ chatgpt_account_id: accountId }), id_token: jwt({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } }), refresh_token: "refresh-test", expires_in: 3600 });
  });
  const flow = await startOpenAIDeviceOAuth(7, "session-seven");
  const result = await pollOpenAIDeviceOAuth(flow.cookie, 7, "session-seven");
  assert.equal(result.status, "connected");
  if (result.status === "connected") {
    assert.equal(result.credential.provider, "openai");
    assert.equal(result.credential.accountId, accountId);
    assert.equal(result.credential.refreshToken, "refresh-test");
  }
  assert.equal(calls, 3);
});

test("renova token OpenAI e preserva refresh token e conta quando não forem rotacionados", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://auth.openai.com/oauth/token");
    const body = new URLSearchParams(init.body as string);
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "refresh-old");
    return Response.json({ access_token: jwt({ chatgpt_account_id: "account_123" }), expires_in: 1200 });
  });
  const refreshed = await refreshOpenAICredential({ provider: "openai", accessToken: "old", refreshToken: "refresh-old", expiresAt: 1, accountId: "account_123" });
  assert.equal(refreshed.refreshToken, "refresh-old");
  assert.equal(refreshed.accountId, "account_123");
  assert.ok(refreshed.expiresAt! > Date.now());
});

test("driver ChatGPT usa Responses Codex com token e conta separados", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, `${OPENAI_CODEX_BASE_URL}/responses`);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("Authorization"), "Bearer access-test");
    assert.equal(headers.get("ChatGPT-Account-Id"), "account_123");
    assert.equal(init.redirect, "error");
    const payload = JSON.parse(init.body as string);
    assert.equal(payload.stream, true);
    assert.equal(payload.store, false);
    assert.equal(payload.input[0].content[0].text, "Olá");
    const events = [
      { type: "response.output_text.delta", delta: "Oi" },
      { type: "response.output_text.delta", delta: "!" },
      { type: "response.completed", response: { model: "gpt-test", usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } } },
    ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    return new Response(events, { headers: { "Content-Type": "text/event-stream" } });
  });
  const options = { provider: "openai" as const, model: "gpt-test", apiKey: "access-test", authType: "oauth" as const, accountId: "account_123", messages: [{ role: "user" as const, content: "Olá" }] };
  assert.equal(resolveCall(options).baseUrl, OPENAI_CODEX_BASE_URL);
  assert.equal((await executeAICompletion(options)).text, "Oi!");
  const iterator = streamAICompletion(options);
  let result = await iterator.next();
  while (!result.done) result = await iterator.next();
  assert.equal(result.value.text, "Oi!");
});
