import test from "node:test";
import assert from "node:assert/strict";
import { parseMoney, roundMoney, splitMoney } from "../lib/money.ts";

test("normaliza valores monetários para duas casas", () => {
  assert.equal(parseMoney("10,235"), 10.24);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(parseMoney("inválido"), 0);
});

test("parcelas somam exatamente o total em centavos", () => {
  const parts = splitMoney(100, 3);
  assert.deepEqual(parts, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(parts.reduce((sum, value) => sum + value, 0) * 100), 10000);
});

