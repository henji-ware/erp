import test from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "segredo-de-teste-com-comprimento-suficiente";

const { SESSION_MAX_AGE_SECONDS, signToken, verifyToken } =
  await import("../lib/session.ts");

test("assina e valida uma sessão", async () => {
  const token = await signToken("42");
  assert.equal(await verifyToken(token), "42");
});

test("rejeita sessão adulterada", async () => {
  const token = await signToken("42");
  const changed = token.replace("v1.42.", "v1.43.");
  assert.equal(await verifyToken(changed), null);
});

test("rejeita sessão vencida mesmo se o cookie for reutilizado", async () => {
  const originalNow = Date.now;
  const issuedAt = 1_800_000_000_000;
  try {
    Date.now = () => issuedAt;
    const token = await signToken("42");
    Date.now = () => issuedAt + (SESSION_MAX_AGE_SECONDS + 1) * 1000;
    assert.equal(await verifyToken(token), null);
  } finally {
    Date.now = originalNow;
  }
});
