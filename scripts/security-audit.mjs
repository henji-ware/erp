import { spawnSync } from "node:child_process";

// O npm herdado por um npm script inclui npm_config_allow_scripts. Quando o
// projeto já usa a allowlist de package.json, o npm recusa essa combinação.
const env = { ...process.env };
delete env.npm_config_allow_scripts;

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Não foi possível localizar o npm CLI");

const result = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev"], {
  env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
