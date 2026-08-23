import { test } from "node:test";
import assert from "node:assert/strict";
import {
  edgeScrollDelta,
  passedThreshold,
  dragOffset,
  DRAG_THRESHOLD_PX,
} from "../lib/kanban.ts";

test("não rola no meio da área", () => {
  assert.equal(edgeScrollDelta(400, 0, 800), 0);
  assert.equal(edgeScrollDelta(100, 0, 800), 0);
});

test("rola para cima perto da borda superior, e mais rápido colado nela", () => {
  const leve = edgeScrollDelta(70, 0, 800); // faixa = 72
  const forte = edgeScrollDelta(0, 0, 800);
  assert.ok(leve < 0, "deveria rolar para cima");
  assert.ok(forte < leve, "colado na borda tem que ser mais rápido");
  assert.equal(forte, -18);
});

test("rola para baixo perto da borda inferior", () => {
  const leve = edgeScrollDelta(730, 0, 800);
  const forte = edgeScrollDelta(800, 0, 800);
  assert.ok(leve > 0);
  assert.ok(forte > leve);
  assert.equal(forte, 18);
});

test("respeita o topo da área rolável, não o topo da janela", () => {
  // No celular a lista começa embaixo da barra do topo: se a faixa fosse
  // medida pela janela, a rolagem automática dispararia atrás da barra.
  assert.equal(edgeScrollDelta(100, 200, 900), -18);
  assert.equal(edgeScrollDelta(500, 200, 900), 0);
});

test("passar do fim da faixa não acelera além do máximo", () => {
  assert.equal(edgeScrollDelta(-500, 0, 800), -18);
  assert.equal(edgeScrollDelta(5000, 0, 800), 18);
});

test("área curta demais não rola por borda", () => {
  // Duas faixas não cabem: qualquer ponto estaria "na borda" e a lista
  // rolaria sozinha o tempo todo.
  assert.equal(edgeScrollDelta(50, 0, 100), 0);
  assert.equal(edgeScrollDelta(10, 0, 100), 0);
});

test("limiar: toque parado não vira arrasto", () => {
  assert.equal(passedThreshold(0, 0), false);
  assert.equal(passedThreshold(3, 3), false);
  assert.equal(passedThreshold(0, DRAG_THRESHOLD_PX), true);
  assert.equal(passedThreshold(-10, 0), true);
  // Diagonal conta pela distância real, não por eixo isolado.
  assert.equal(passedThreshold(6, 6), true);
});

test("deslocamento acompanha o dedo mesmo com a lista rolando", () => {
  const start = { x: 100, y: 200 };

  assert.deepEqual(dragOffset({ x: 140, y: 260 }, start), { dx: 40, dy: 60 });

  // Dedo parado, lista rolou 150px: sem somar o scroll o cartão subiria
  // junto com o conteúdo e escaparia do dedo.
  assert.deepEqual(dragOffset({ x: 100, y: 200 }, start, 150), { dx: 0, dy: 150 });
});
