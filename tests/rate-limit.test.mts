import test from "node:test";
import assert from "node:assert/strict";
import { consumeBucket } from "../lib/rate-limit-core.ts";

test("bloqueia após o limite e libera na próxima janela", () => {
  const buckets = new Map();
  assert.equal(consumeBucket(buckets, "login", 2, 1000, 0).allowed, true);
  assert.equal(consumeBucket(buckets, "login", 2, 1000, 10).allowed, true);
  const blocked = consumeBucket(buckets, "login", 2, 1000, 20);
  assert.equal(blocked.allowed, false);
  assert.equal(consumeBucket(buckets, "login", 2, 1000, 1000).allowed, true);
});

