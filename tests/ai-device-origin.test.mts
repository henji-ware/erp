import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeviceRequestOriginAllowed } from "../lib/ai/device-origin.ts";

test("device login accepts the current origin without APP_URL", () => {
  assert.equal(isDeviceRequestOriginAllowed(new Headers({ origin: "https://erp.test" }), "https://erp.test/api/ai/openai-device"), true);
});
test("device login supports reverse proxies using browser Fetch Metadata", () => {
  assert.equal(isDeviceRequestOriginAllowed(new Headers({ origin: "https://erp.test", "sec-fetch-site": "same-origin" }), "http://localhost:3000/api/ai/openai-device"), true);
});
test("device login rejects cross-origin, same-site, missing and malformed origins", () => {
  for (const values of [{ origin: "https://evil.test" }, { origin: "https://erp.test", "sec-fetch-site": "cross-site" }, { origin: "https://erp.test", "sec-fetch-site": "same-site" }, {}, { origin: "null" }, { origin: "https://erp.test/path", "sec-fetch-site": "same-origin" }]) {
    assert.equal(isDeviceRequestOriginAllowed(new Headers(values as Record<string, string>), "https://erp.test/api/ai/openai-device"), false);
  }
});
