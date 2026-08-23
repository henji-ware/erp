import { test } from "node:test";
import assert from "node:assert/strict";
import { isStale, versionValue } from "../lib/concurrency.ts";

const AGORA = new Date("2026-08-23T14:00:00.000Z");

test("mesma versão passa", () => {
  assert.equal(isStale(AGORA.toISOString(), AGORA), false);
});

test("registro alterado por outra pessoa é recusado", () => {
  // O formulário carregou às 14:00; alguém salvou às 14:05.
  const carregado = new Date("2026-08-23T14:00:00.000Z");
  const noBanco = new Date("2026-08-23T14:05:00.000Z");
  assert.equal(isStale(carregado.toISOString(), noBanco), true);
});

test("diferença de milissegundos não conta como conflito", () => {
  // Postgres guarda microssegundos, o ISO string leva milissegundos: sem
  // folga, todo salvamento acusaria conflito consigo mesmo.
  const noBanco = new Date("2026-08-23T14:00:00.400Z");
  const carregado = new Date("2026-08-23T14:00:00.000Z");
  assert.equal(isStale(carregado.toISOString(), noBanco), false);
});

test("um segundo inteiro de diferença ainda passa; mais que isso não", () => {
  const carregado = new Date("2026-08-23T14:00:00.000Z");
  assert.equal(isStale(carregado.toISOString(), new Date("2026-08-23T14:00:01.000Z")), false);
  assert.equal(isStale(carregado.toISOString(), new Date("2026-08-23T14:00:01.001Z")), true);
});

test("versão enviada mais NOVA que a do banco não é conflito", () => {
  // Relógio do cliente adiantado, ou releitura logo após gravar. O que
  // importa é o banco ter avançado ALÉM do que o formulário conhecia.
  const noBanco = new Date("2026-08-23T14:00:00.000Z");
  const carregado = new Date("2026-08-23T14:10:00.000Z");
  assert.equal(isStale(carregado.toISOString(), noBanco), false);
});

test("registro sem carimbo deixa passar", () => {
  // Linhas anteriores à migração do updatedAt não podem ficar intraváveis.
  assert.equal(isStale(AGORA.toISOString(), null), false);
  assert.equal(isStale(AGORA.toISOString(), undefined), false);
});

test("campo ausente ou lixo deixa passar", () => {
  // A guarda protege contra sobrescrita acidental — não é controle de
  // acesso, então não faz sentido travar por campo malformado.
  for (const v of [undefined, null, "", "   ", "não é data", 42, {}]) {
    assert.equal(isStale(v, AGORA), false, `deveria passar: ${JSON.stringify(v)}`);
  }
});

test("versionValue serializa e volta redondo", () => {
  assert.equal(versionValue(AGORA), "2026-08-23T14:00:00.000Z");
  assert.equal(versionValue(null), "");
  assert.equal(isStale(versionValue(AGORA), AGORA), false);
});
