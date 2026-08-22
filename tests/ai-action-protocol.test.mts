import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractActions,
  hasUnclosedAction,
  stripUnclosedAction,
  isActionKind,
} from "../lib/ai/action-protocol.ts";

const fence = (body: string) => "```drr-acao\n" + body + "\n```";

test("extrai a ação e tira o bloco do texto exibido", () => {
  const msg =
    "Vou preparar o orçamento. Revise e confirme abaixo.\n\n" +
    fence('{ "acao": "criar_orcamento", "dados": { "nome": "Mezanino", "valor": 48000 } }');

  const { text, actions } = extractActions(msg);

  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "criar_orcamento");
  assert.deepEqual(actions[0].data, { nome: "Mezanino", valor: 48000 });
  assert.ok(!text.includes("drr-acao"), "o bloco não pode sobrar no texto");
  assert.ok(text.startsWith("Vou preparar"));
});

test("JSON solto na resposta NÃO vira ação", () => {
  // Este é o ponto central: sem a cerca exata, qualquer JSON que o modelo
  // escrevesse (ou que o usuário colasse numa pergunta) viraria comando.
  const msg =
    'Segue o formato usado: { "acao": "criar_pedido", "dados": { "clienteId": 1 } }';
  const { actions } = extractActions(msg);
  assert.equal(actions.length, 0);
});

test("cerca de outra linguagem NÃO vira ação", () => {
  const msg = '```json\n{ "acao": "criar_cliente", "dados": { "nome": "X" } }\n```';
  const { actions } = extractActions(msg);
  assert.equal(actions.length, 0);
});

test("ação desconhecida é descartada", () => {
  const msg = fence('{ "acao": "excluir_cliente", "dados": { "id": 3 } }');
  const { actions } = extractActions(msg);
  assert.equal(actions.length, 0);
});

test("JSON malformado não quebra a renderização", () => {
  const msg = "Texto antes\n" + fence('{ "acao": "criar_cliente", "dados": {');
  const { text, actions } = extractActions(msg);
  assert.equal(actions.length, 0);
  assert.equal(text, "Texto antes");
});

test("dados precisa ser objeto — array é recusado", () => {
  const msg = fence('{ "acao": "criar_cliente", "dados": ["nome"] }');
  assert.equal(extractActions(msg).actions.length, 0);
});

test("dados ausente é recusado", () => {
  const msg = fence('{ "acao": "criar_cliente" }');
  assert.equal(extractActions(msg).actions.length, 0);
});

test("vários blocos na mesma mensagem são todos extraídos", () => {
  const msg =
    fence('{ "acao": "criar_cliente", "dados": { "nome": "A" } }') +
    "\ne também\n" +
    fence('{ "acao": "criar_orcamento", "dados": { "nome": "B" } }');

  const { actions, text } = extractActions(msg);
  assert.deepEqual(actions.map((a) => a.kind), ["criar_cliente", "criar_orcamento"]);
  assert.equal(text, "e também");
});

test("bloco ainda aberto é detectado e cortado durante o streaming", () => {
  const parcial = 'Preparando o cadastro.\n```drr-acao\n{ "acao": "criar_clien';
  assert.equal(hasUnclosedAction(parcial), true);
  assert.equal(stripUnclosedAction(parcial), "Preparando o cadastro.");
});

test("bloco fechado não é tratado como aberto", () => {
  const completo = fence('{ "acao": "criar_cliente", "dados": { "nome": "A" } }');
  assert.equal(hasUnclosedAction(completo), false);
});

test("isActionKind aceita só o catálogo", () => {
  assert.equal(isActionKind("criar_orcamento"), true);
  assert.equal(isActionKind("criar_usuario"), false);
  assert.equal(isActionKind(""), false);
  assert.equal(isActionKind(null), false);
  assert.equal(isActionKind({ toString: () => "criar_cliente" }), false);
});
