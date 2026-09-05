import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { startOAuth, validateOAuth, pkceChallenge, oauthAvailability, oauthOrigin, isOAuthProvider, encodeOAuthCredential, decodeOAuthCredential, exchangeOAuthCode, refreshGoogleCredential, GOOGLE_AI_SCOPE } from "../lib/ai/oauth.ts";
import { encryptSecret } from "../lib/ai/crypto.ts";
import { geminiAuthHeaders } from "../lib/ai/request-auth.ts";
import { executeAICompletion, streamAICompletion, resolveCall } from "../lib/ai/client.ts";

const originalEnv = { ...process.env };
beforeEach(() => {
  process.env.APP_URL = "https://erp.example.test";
  process.env.AI_ENCRYPTION_KEY = "oauth-test-only-master-secret-not-a-real-credential";
  process.env.GOOGLE_AI_OAUTH_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_AI_OAUTH_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_AI_PROJECT_ID = "test-project";
});
afterEach(() => { process.env = { ...originalEnv }; });

function pending(provider: "openrouter" | "gemini" = "openrouter") {
  const flow = startOAuth(provider, 42, "session-test");
  const url = new URL(flow.url);
  const state = provider === "openrouter" ? new URL(url.searchParams.get("callback_url")!).searchParams.get("state") : url.searchParams.get("state");
  return { flow, url, state, pending: validateOAuth(flow.cookie, provider, 42, "session-test", state) };
}

test("PKCE S256 corresponde ao vetor do RFC 7636", () => {
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("OpenRouter usa callback fixo, estado aleatório e PKCE sem expor o verificador", () => {
  const one = pending();
  const two = pending();
  assert.equal(one.url.origin, "https://openrouter.ai");
  assert.equal(new URL(one.pending.callback).pathname, "/api/ai/oauth/openrouter");
  assert.equal(one.url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(one.url.searchParams.get("code_challenge"), pkceChallenge(one.pending.verifier));
  assert.notEqual(one.state, two.state);
  assert.ok(!one.flow.cookie.includes(one.pending.verifier));
  assert.ok(!one.flow.url.includes(one.pending.verifier));
});

test("Google pede consentimento offline e escopo de API, não perfil ou e-mail", () => {
  const { url } = pending("gemini");
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://erp.example.test/api/ai/oauth/gemini");
  assert.equal(url.searchParams.get("scope"), GOOGLE_AI_SCOPE);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(!url.href.includes("test-client-secret"));
});

test("retorno exige estado, usuário, sessão e provedor originais", () => {
  const { flow, state } = pending();
  for (const [provider, user, session, supplied] of [
    ["gemini", 42, "session-test", state],
    ["openrouter", 43, "session-test", state],
    ["openrouter", 42, "another-session", state],
    ["openrouter", 42, "session-test", null],
    ["openrouter", 42, "session-test", "wrong-state"],
  ] as const) assert.throws(() => validateOAuth(flow.cookie, provider, user, session, supplied));
});

test("retorno rejeita cookie ausente, adulterado, de outro propósito ou expirado", () => {
  const { flow, state, pending: value } = pending();
  assert.throws(() => validateOAuth(undefined, "openrouter", 42, "session-test", state));
  assert.throws(() => validateOAuth(flow.cookie.slice(0, -12), "openrouter", 42, "session-test", state));
  assert.throws(() => validateOAuth(encryptSecret(JSON.stringify({ ...value, purpose: "different" })), "openrouter", 42, "session-test", state));
  assert.throws(() => validateOAuth(flow.cookie, "openrouter", 42, "session-test", state, value.createdAt + 600_000));
  assert.throws(() => validateOAuth(flow.cookie, "openrouter", 42, "session-test", state, value.createdAt - 1));
});

test("configuração ausente desabilita Google sem quebrar OpenRouter", () => {
  delete process.env.GOOGLE_AI_OAUTH_CLIENT_SECRET;
  assert.deepEqual(oauthAvailability(), { openrouter: true, gemini: false });
  assert.throws(() => startOAuth("gemini", 42, "session-test"));
});

test("origem exige HTTPS em produção e não aceita caminho, credenciais ou query", () => {
  for (const value of ["http://erp.example.test", "https://erp.example.test/path", "https://user:pass@erp.example.test", "https://erp.example.test?redirect=evil"]) {
    process.env.APP_URL = value;
    assert.throws(() => oauthOrigin());
  }
  assert.equal(isOAuthProvider("openai"), false);
  assert.equal(isOAuthProvider("__proto__"), false);
});

test("envelope OAuth não confunde chaves antigas e valida tokens", () => {
  assert.equal(decodeOAuthCredential("manual-test-key"), null);
  const credential = { provider: "openrouter" as const, accessToken: "delegated-test-key" };
  assert.deepEqual(decodeOAuthCredential(encodeOAuthCredential(credential)), credential);
  assert.throws(() => decodeOAuthCredential("drr-ai-oauth-v1:{}"));
  assert.throws(() => decodeOAuthCredential(encodeOAuthCredential({ ...credential, accessToken: "bad\r\ntoken" })));
});

test("troca OpenRouter usa POST fixo no servidor e valida a chave retornada", async (t) => {
  const { pending: value } = pending();
  const fetchMock = t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://openrouter.ai/api/v1/auth/keys");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body as string), { code: "authorization-code", code_verifier: value.verifier, code_challenge_method: "S256" });
    return Response.json({ key: "delegated-test-key" });
  });
  assert.deepEqual(await exchangeOAuthCode(value, "authorization-code"), { provider: "openrouter", accessToken: "delegated-test-key" });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("erros de OAuth não repassam o corpo sensível do provedor", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "secret-code-and-token" }, { status: 403 }));
  await assert.rejects(exchangeOAuthCode(pending().pending, "code"), (err: Error) => !err.message.includes("secret-code-and-token"));
});

test("Google troca código e renova sem perder refresh token nem projeto original", async (t) => {
  let requestNumber = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://oauth2.googleapis.com/token");
    const body = init.body as URLSearchParams;
    assert.equal(body.get("client_secret"), "test-client-secret");
    assert.equal(init.redirect, "error");
    requestNumber++;
    if (requestNumber === 1) {
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.ok(body.get("code_verifier"));
      return Response.json({ access_token: "access-one", refresh_token: "refresh-test", token_type: "Bearer", expires_in: 3600, scope: GOOGLE_AI_SCOPE });
    }
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "refresh-test");
    return Response.json({ access_token: "access-two", token_type: "Bearer", expires_in: 3600 });
  });
  const one = await exchangeOAuthCode(pending("gemini").pending, "test-code");
  process.env.GOOGLE_AI_PROJECT_ID = "different-project";
  const two = await refreshGoogleCredential(one);
  assert.equal(two.accessToken, "access-two");
  assert.equal(two.refreshToken, "refresh-test");
  assert.equal(two.quotaProject, "test-project");
  assert.ok(two.expiresAt! > Date.now());
});

test("Google rejeita ausência de refresh token, escopo recusado e validade inválida", async (t) => {
  for (const data of [
    { access_token: "a", token_type: "Bearer", expires_in: 3600 },
    { access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 3600, scope: "email" },
    { access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: -1 },
  ]) {
    const fake = t.mock.method(globalThis, "fetch", async () => Response.json(data));
    await assert.rejects(exchangeOAuthCode(pending("gemini").pending, "test-code"));
    fake.mock.restore();
  }
});

test("OAuth ignora proxy customizado e só aceita provedores implementados", () => {
  const options = { provider: "gemini" as const, model: "test-model", apiKey: "oauth-test-token", authType: "oauth" as const, quotaProject: "test-project", baseUrl: "https://attacker.example.test", messages: [{ role: "user" as const, content: "test" }] };
  assert.equal(resolveCall(options).baseUrl, "https://generativelanguage.googleapis.com");
  assert.equal(resolveCall({ ...options, provider: "openrouter" }).baseUrl, "https://openrouter.ai/api/v1");
  assert.throws(() => resolveCall({ ...options, provider: "openai" }));
  assert.deepEqual(geminiAuthHeaders("manual-key"), { "x-goog-api-key": "manual-key" });
  assert.deepEqual(geminiAuthHeaders("access-token", "oauth", "project"), { Authorization: "Bearer access-token", "x-goog-user-project": "project" });
});

test("Gemini usa Bearer em geração e streaming, sem token na URL", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(url.startsWith("https://generativelanguage.googleapis.com/"));
    assert.ok(!url.includes("oauth-test-token"));
    assert.ok(!url.includes("key="));
    const headers = new Headers(init.headers);
    assert.equal(headers.get("Authorization"), "Bearer oauth-test-token");
    assert.equal(headers.get("x-goog-user-project"), "test-project");
    assert.equal(headers.get("x-goog-api-key"), null);
    assert.equal(init.redirect, "error");
    const body = { candidates: [{ content: { parts: [{ text: "OK" }] } }] };
    return url.includes("streamGenerateContent") ? new Response(`data: ${JSON.stringify(body)}\n\n`) : Response.json(body);
  });
  const options = { provider: "gemini" as const, model: "test-model", apiKey: "oauth-test-token", authType: "oauth" as const, quotaProject: "test-project", messages: [{ role: "user" as const, content: "test" }] };
  assert.equal((await executeAICompletion(options)).text, "OK");
  const iterator = streamAICompletion(options);
  let result = await iterator.next();
  while (!result.done) result = await iterator.next();
  assert.equal(result.value.text, "OK");
});
