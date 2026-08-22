import { test } from "node:test";
import assert from "node:assert/strict";
import { lastMonths, monthKey, monthLabel } from "../lib/months.ts";

test("lastMonths devolve a janela do mais antigo ao mais recente", () => {
  const ref = new Date(2026, 7, 21); // 21/ago/2026
  const months = lastMonths(6, ref);

  assert.equal(months.length, 6);
  assert.deepEqual(
    months.map((m) => m.label),
    ["mar/26", "abr/26", "mai/26", "jun/26", "jul/26", "ago/26"],
  );
  // O último balde é sempre o mês da referência.
  assert.equal(months[months.length - 1].key, monthKey(ref));
});

test("a janela atravessa a virada do ano", () => {
  const ref = new Date(2026, 1, 10); // fev/2026
  const months = lastMonths(4, ref);

  assert.deepEqual(
    months.map((m) => m.label),
    ["nov/25", "dez/25", "jan/26", "fev/26"],
  );
  assert.equal(months[0].start.getFullYear(), 2025);
});

test("cada balde começa no dia 1º, para o mês entrar inteiro", () => {
  const months = lastMonths(3, new Date(2026, 7, 31));
  for (const m of months) {
    assert.equal(m.start.getDate(), 1);
  }
});

test("o dia 31 não pula um mês na aritmética", () => {
  // new Date(2026, 2, 31) seria 31/mar; recuar um mês com setMonth daria
  // 31/fev => 3/mar. Como lastMonths fixa o dia 1º, isso não acontece.
  const months = lastMonths(2, new Date(2026, 2, 31)); // 31/mar/2026
  assert.deepEqual(months.map((m) => m.label), ["fev/26", "mar/26"]);
});

test("monthKey separa meses de anos diferentes", () => {
  assert.notEqual(monthKey(new Date(2025, 0, 15)), monthKey(new Date(2026, 0, 15)));
  assert.equal(monthKey(new Date(2026, 0, 1)), monthKey(new Date(2026, 0, 31)));
});

test("monthLabel usa o mês abreviado em português", () => {
  assert.equal(monthLabel(new Date(2026, 11, 25)), "dez/26");
});
