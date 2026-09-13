import { test } from "node:test";
import assert from "node:assert/strict";
import { agentRuntimeCapability, requireAgentRuntime } from "../lib/ai/agent-capability.ts";

test("login por agente fica disponível em um processo Node persistente", () => {
  assert.deepEqual(agentRuntimeCapability({}), {
    available: true,
    environment: "persistent",
  });
  assert.doesNotThrow(() => requireAgentRuntime({}));
});

test("Vercel bloqueia login por CLI antes de tentar gravar em /var/task", () => {
  const capability = agentRuntimeCapability({ VERCEL: "1" });
  assert.equal(capability.available, false);
  assert.equal(capability.environment, "serverless");
  assert.match(capability.reason || "", /serverless/i);
  assert.match(capability.reason || "", /chave de API/i);
  assert.throws(() => requireAgentRuntime({ VERCEL: "1" }), /serverless/i);
});

test("outros runtimes efêmeros e desativação explícita também são bloqueados", () => {
  for (const env of [
    { AWS_LAMBDA_FUNCTION_NAME: "erp" },
    { NETLIFY: "true" },
    { CF_PAGES: "1" },
  ]) {
    assert.equal(agentRuntimeCapability(env).environment, "serverless");
  }
  assert.equal(agentRuntimeCapability({ AI_AGENT_RUNTIME: "disabled" }).environment, "disabled");
});
