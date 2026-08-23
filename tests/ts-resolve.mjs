// Resolvedor para os testes.
//
// O runner do Node roda TypeScript direto (--experimental-strip-types), mas
// o resolvedor de ESM exige extensão explícita no import. O código do projeto
// escreve `from "./money"` e `from "@/lib/..."`, que é o que o bundler do
// Next entende — então, sem isto, qualquer módulo que importe outro módulo
// simplesmente não carrega no teste.
//
// Foi essa a razão de só existirem testes de arquivos-folha (sem imports).
// Com o gancho abaixo dá para testar lib/finance.ts, lib/reports.ts e
// qualquer outro que dependa de vizinhos.

import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Já tem extensão de módulo? Então não é com a gente. */
const temExtensao = (s) => /\.[mc]?[jt]sx?$/.test(s);

/** Tenta `.ts`, `.tsx` e `/index.ts` — a ordem que o projeto usa. */
function primeiroQueExiste(base) {
  for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(cand)) return pathToFileURL(cand).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Alias "@/..." do tsconfig — mesmo mapeamento que o Next usa.
    if (specifier.startsWith("@/")) {
      const url = primeiroQueExiste(path.join(ROOT, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }

    // Relativo sem extensão: "./money" -> "./money.ts".
    if (specifier.startsWith(".") && !temExtensao(specifier)) {
      // fileURLToPath e não URL.pathname: no Windows o pathname vem como
      // "/C:/Users/...", e path.resolve trataria isso como caminho relativo à
      // raiz do drive atual, gerando "C:\C:\Users\...".
      const from = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : ROOT;
      const url = primeiroQueExiste(path.resolve(from, specifier));
      if (url) return { url, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
