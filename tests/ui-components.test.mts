import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Exercise actual JSX markup without a database, session, or provider account.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { default: ProviderLogo } = await import("../app/components/ProviderLogo.tsx");
const { SearchBar } = await import("../app/components/SearchBar.tsx");
const { default: DocumentInput } = await import("../app/components/DocumentInput.tsx");

test("shared provider logo renders a local image on a theme-independent background", () => {
  const html = renderToStaticMarkup(React.createElement(ProviderLogo, { provider: "openai" }));
  assert.match(html, /src="\/ai-logos\/openai.svg"/);
  assert.match(html, /bg-\[#ffffff\]/);
  assert.match(html, /alt=""/);
  const custom = renderToStaticMarkup(React.createElement(ProviderLogo, { provider: "custom" }));
  assert.match(custom, /<svg/);
  assert.doesNotMatch(custom, /<img/);
});
test("list search has an explicit submit button and accessible search landmark", () => {
  const html = renderToStaticMarkup(React.createElement(SearchBar, { defaultValue: "A&B", placeholder: "Buscar clientes" }));
  assert.match(html, /role="search"/);
  assert.match(html, /aria-label="Buscar clientes"/);
  assert.match(html, /type="submit"/);
  assert.match(html, /value="A&amp;B"/);
});
test("invalid document exposes a linked label and validation message", () => {
  const html = renderToStaticMarkup(React.createElement(DocumentInput, { defaultValue: "11111111111" }));
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /<label for=/);
  assert.match(html, /CPF inválido/);
});
