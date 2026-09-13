import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("all branded providers have bundled SVG logos without external resources", () => {
  for (const name of ["openai", "claude-color", "gemini-color", "deepseek-color", "groq", "mistral-color", "grok", "cohere-color", "openrouter", "ollama"]) {
    const svg = readFileSync(new URL(`../public/ai-logos/${name}.svg`, import.meta.url), "utf8");
    assert.match(svg, /<svg\s/);
    assert.match(svg, /viewBox=/);
    assert.match(svg, /<path\s/);
    assert.doesNotMatch(svg, /<script|<foreignObject|\bon\w+=|(?:href|src)=/i);
  }
});
