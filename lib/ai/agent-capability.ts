export interface AgentRuntimeCapability {
  available: boolean;
  environment: "persistent" | "serverless" | "disabled";
  reason?: string;
}

const SERVERLESS_ENV_VARS = [
  "VERCEL",
  "AWS_LAMBDA_FUNCTION_NAME",
  "NETLIFY",
  "CF_PAGES",
] as const;

const SERVERLESS_REASON =
  "A conexão por Codex ou Claude Code não está disponível nesta implantação serverless. " +
  "Esses logins precisam do executável e de um processo persistente no mesmo computador do ERP. " +
  "Execute o ERP localmente ou em uma VPS, ou use uma chave de API abaixo.";

/**
 * Codex App Server e Claude Code mantêm processos e arquivos de autenticação
 * entre requisições. Uma função serverless pode ser encerrada ou substituída
 * a qualquer momento, portanto não consegue sustentar esse contrato.
 */
export function agentRuntimeCapability(
  env: NodeJS.ProcessEnv = process.env,
): AgentRuntimeCapability {
  if (env.AI_AGENT_RUNTIME?.trim().toLowerCase() === "disabled") {
    return {
      available: false,
      environment: "disabled",
      reason: "A conexão por Codex e Claude Code foi desabilitada neste servidor. Use uma chave de API abaixo.",
    };
  }

  if (SERVERLESS_ENV_VARS.some((name) => Boolean(env[name]?.trim()))) {
    return { available: false, environment: "serverless", reason: SERVERLESS_REASON };
  }

  return { available: true, environment: "persistent" };
}

export function requireAgentRuntime(env: NodeJS.ProcessEnv = process.env): void {
  const capability = agentRuntimeCapability(env);
  if (!capability.available) throw new Error(capability.reason);
}
