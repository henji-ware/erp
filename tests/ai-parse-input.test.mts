import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseModelMoney,
  parseModelId,
  parseModelEnum,
} from "../lib/ai/parse-input.ts";

test("lê valor em pt-BR sem perder as casas de milhar", () => {
  // O bug original: parseMoney("48.000,00") devolvia 48.
  assert.equal(parseModelMoney("48.000,00"), 48000);
  assert.equal(parseModelMoney("1.234,56"), 1234.56);
  assert.equal(parseModelMoney("1.000.000"), 1000000);
  assert.equal(parseModelMoney("0,50"), 0.5);
  assert.equal(parseModelMoney("1,00"), 1);
});

test("lê valor em en-US", () => {
  assert.equal(parseModelMoney("1,234.56"), 1234.56);
  assert.equal(parseModelMoney("48,000"), 48000);
  assert.equal(parseModelMoney("48000.50"), 48000.5);
});

test("ponto sozinho: milhar quando são grupos de 3, decimal quando não", () => {
  assert.equal(parseModelMoney("48.000"), 48000);
  assert.equal(parseModelMoney("48.5"), 48.5);
  assert.equal(parseModelMoney("48.55"), 48.55);
});

test("aceita número e símbolo de moeda", () => {
  assert.equal(parseModelMoney(48000), 48000);
  assert.equal(parseModelMoney(48000.555), 48000.56);
  assert.equal(parseModelMoney("R$ 48.000,00"), 48000);
  assert.equal(parseModelMoney("R$48000"), 48000);
});

test("texto NÃO vira zero — vira null", () => {
  // parseMoney devolvia 0 aqui, e o registro nascia zerado enquanto o
  // cartão de confirmação exibia o texto original.
  for (const v of ["a combinar", "abc", "48k", "", "  ", "R$", null, undefined, {}, []]) {
    assert.equal(parseModelMoney(v), null, `deveria recusar ${JSON.stringify(v)}`);
  }
});

test("escrita sem sentido é recusada", () => {
  assert.equal(parseModelMoney("1.2.3"), null);
  // ".replace(",", ".")" troca só a primeira ocorrência: sem checar a forma
  // final, isto virava "1.2,3" e parseFloat lia 1.2.
  assert.equal(parseModelMoney("1,2,3"), null);
  assert.equal(parseModelMoney("1,,2"), null);
  assert.equal(parseModelMoney("1."), null);
  assert.equal(parseModelMoney(",50"), null);
  assert.equal(parseModelMoney(Number.NaN), null);
  assert.equal(parseModelMoney(Number.POSITIVE_INFINITY), null);
});

test("id: distingue ausente, inválido e válido", () => {
  // null = não informado; undefined = informado e inválido (vira erro).
  assert.equal(parseModelId(undefined), null);
  assert.equal(parseModelId(null), null);
  assert.equal(parseModelId(""), null);

  assert.equal(parseModelId(12), 12);
  assert.equal(parseModelId("12"), 12);

  assert.equal(parseModelId("ACME Ltda"), undefined);
  assert.equal(parseModelId("12abc"), undefined);
  assert.equal(parseModelId(0), undefined);
  assert.equal(parseModelId(-3), undefined);
  assert.equal(parseModelId(1.5), undefined);
  assert.equal(parseModelId({}), undefined);
});

test("enum: sem fallback silencioso", () => {
  const RISCOS = ["VERDE", "AMARELO", "VERMELHO"] as const;
  const sinonimos = { ALTO: "VERMELHO", CRITICO: "VERMELHO", BAIXO: "VERDE" } as const;

  assert.equal(parseModelEnum("VERDE", RISCOS), "VERDE");
  assert.equal(parseModelEnum("vermelho", RISCOS), "VERMELHO");
  assert.equal(parseModelEnum("  Amarelo  ", RISCOS), "AMARELO");

  // O caso do bug: antes isto virava VERDE (risco mais baixo) em silêncio.
  assert.equal(parseModelEnum("ALTO", RISCOS), undefined);
  assert.equal(parseModelEnum("ALTO", RISCOS, sinonimos), "VERMELHO");

  assert.equal(parseModelEnum("", RISCOS), undefined);
  assert.equal(parseModelEnum(null, RISCOS), undefined);
  assert.equal(parseModelEnum(7, RISCOS), undefined);
});
