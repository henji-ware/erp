import { test } from "node:test";
import assert from "node:assert/strict";
import { listPageHref } from "../lib/list-navigation.ts";

test("return to first page removes stale page while retaining filters", () => {
  assert.equal(listPageHref("/customers", 1, { page: "5", q: "João", status: "active" }), "/customers?q=Jo%C3%A3o&status=active");
});
test("next page preserves and encodes filters", () => {
  assert.equal(listPageHref("/finance", 3, { q: "A&B", page: "2", empty: "", missing: undefined }), "/finance?q=A%26B&page=3");
  assert.equal(listPageHref("/orders", 1), "/orders");
});
