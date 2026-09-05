import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { encodeOAuthCredential } from "../lib/ai/oauth.ts";
import { encryptSecret, decryptSecret } from "../lib/ai/crypto.ts";

// Injeta um cliente falso antes de importar o repositório. Nenhum banco é acessado.
const unexpected = async (..._args: any[]): Promise<any> => { throw new Error("Consulta não simulada"); };
const prisma = { aICredential: { upsert: unexpected, findMany: unexpected, findUnique: unexpected, updateMany: unexpected, deleteMany: unexpected } };
(globalThis as any).prisma = prisma;
const { resolveProviderAuth, saveOAuthCredential, listCredentials, deleteCredential } = await import("../lib/ai/credentials.ts");

const originalEnv = { ...process.env };
beforeEach(() => {
  process.env.AI_ENCRYPTION_KEY = "oauth-credentials-test-only-master-secret";
  process.env.GOOGLE_AI_OAUTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_AI_OAUTH_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_AI_PROJECT_ID = "test-project";
});
afterEach(() => { process.env = { ...originalEnv }; });

test("OAuth fica cifrado e a visualização pública não inclui tokens", async (t) => {
  let row: any;
  t.mock.method(prisma.aICredential, "upsert", async (query: any) => { row = { ...query.create, updatedAt: new Date() }; return row; });
  t.mock.method(prisma.aICredential, "findMany", async () => [row]);
  await saveOAuthCredential(7, { provider: "openrouter", accessToken: "test-sensitive-access-token" });
  assert.ok(!row.keyCipher.includes("test-sensitive-access-token"));
  assert.ok(decryptSecret(row.keyCipher)?.includes("test-sensitive-access-token"));
  assert.equal(row.userId, 7);
  assert.equal(row.baseUrl, "https://openrouter.ai/api/v1");
  const view = await listCredentials(7);
  assert.equal(view[0].authType, "oauth");
  assert.equal(view[0].broken, false);
  assert.ok(!JSON.stringify(view).includes("test-sensitive-access-token"));
});

test("OAuth é resolvido por usuário e ignora URL do navegador", async (t) => {
  t.mock.method(prisma.aICredential, "findUnique", async (query: any) => {
    assert.deepEqual(query.where.userId_provider, { userId: 7, provider: "openrouter" });
    return { keyCipher: encryptSecret(encodeOAuthCredential({ provider: "openrouter", accessToken: "delegated-token" })), baseUrl: "https://bad.example.test" };
  });
  const value = await resolveProviderAuth(7, "openrouter", "", "https://other.example.test");
  assert.equal(value.apiKey, "delegated-token");
  assert.equal(value.authType, "oauth");
  assert.equal(value.baseUrl, "https://openrouter.ai/api/v1");
});

test("chaves antigas continuam válidas; rascunho não usa token salvo", async (t) => {
  const read = t.mock.method(prisma.aICredential, "findUnique", async () => ({ keyCipher: encryptSecret("manual-key"), baseUrl: "https://proxy.example.test" }));
  assert.deepEqual(await resolveProviderAuth(7, "openai"), { apiKey: "manual-key", baseUrl: "https://proxy.example.test", authType: "api-key" });
  assert.deepEqual(await resolveProviderAuth(7, "gemini", "new-key", "https://draft.example.test"), { apiKey: "new-key", baseUrl: "https://draft.example.test", authType: "api-key" });
  assert.equal(read.mock.callCount(), 1);
});

test("Google renova com compare-and-swap sem sobrescrever desconexão", async (t) => {
  const old = encryptSecret(encodeOAuthCredential({ provider: "gemini", accessToken: "expired", refreshToken: "refresh-token", expiresAt: Date.now() - 1000, quotaProject: "test-project" }));
  t.mock.method(prisma.aICredential, "findUnique", async () => ({ keyCipher: old }));
  t.mock.method(globalThis, "fetch", async () => Response.json({ access_token: "new-access-token", token_type: "Bearer", expires_in: 3600 }));
  let updated = true;
  t.mock.method(prisma.aICredential, "updateMany", async (query: any) => {
    assert.deepEqual(query.where, { userId: 7, provider: "gemini", keyCipher: old });
    assert.ok(!query.data.keyCipher.includes("new-access-token"));
    return { count: updated ? 1 : 0 };
  });
  assert.equal((await resolveProviderAuth(7, "gemini")).apiKey, "new-access-token");
  updated = false;
  await assert.rejects(resolveProviderAuth(7, "gemini"), /conexão mudou/);
});

test("token válido não renova; desconectar remove só o provedor do usuário", async (t) => {
  t.mock.method(prisma.aICredential, "findUnique", async () => ({ keyCipher: encryptSecret(encodeOAuthCredential({ provider: "gemini", accessToken: "valid-token", refreshToken: "refresh", expiresAt: Date.now() + 3600_000, quotaProject: "test-project" })) }));
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("Não deve chamar rede"); });
  const deleted = t.mock.method(prisma.aICredential, "deleteMany", async (query: any) => {
    assert.deepEqual(query.where, { userId: 7, provider: "gemini" });
    return { count: 1 };
  });
  assert.equal((await resolveProviderAuth(7, "gemini")).apiKey, "valid-token");
  await deleteCredential(7, "gemini");
  assert.equal(network.mock.callCount(), 0);
  assert.equal(deleted.mock.callCount(), 1);
});
