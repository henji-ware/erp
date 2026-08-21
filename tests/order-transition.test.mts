import test from "node:test";
import assert from "node:assert/strict";
import { orderTransitionEffect } from "../lib/order-transition.ts";

test("aplica e reverte efeitos somente ao cruzar a fronteira ativa", () => {
  assert.equal(orderTransitionEffect("DRAFT", "CONFIRMED"), "APPLY");
  assert.equal(orderTransitionEffect("CONFIRMED", "INVOICED"), "NONE");
  assert.equal(orderTransitionEffect("INVOICED", "CANCELLED"), "REVERSE");
  assert.equal(orderTransitionEffect("DRAFT", "CANCELLED"), "NONE");
});

