import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paidAmount,
  remaining,
  deriveStatus,
  dueInfo,
} from "../lib/finance.ts";
import { splitMoney } from "../lib/money.ts";

/**
 * Estas funções decidem se um título está EM ABERTO, PARCIAL ou PAGO — e daí
 * saem o "a receber" do dashboard, o sino de vencidos e o e-mail diário.
 * Um erro aqui não trava tela nenhuma: mostra um número errado.
 */

test("paidAmount soma os pagamentos e aguenta título sem nenhum", () => {
  assert.equal(paidAmount({ amount: 100, payments: [] }), 0);
  assert.equal(paidAmount({ amount: 100 }), 0, "sem a lista carregada, zero");
  assert.equal(
    paidAmount({ amount: 100, payments: [{ amount: 30 }, { amount: 20.5 }] }),
    50.5,
  );
});

test("remaining nunca fica negativo", () => {
  // Pagamento a maior acontece (juros, arredondamento do cliente). O saldo
  // devedor tem que ir a zero, não virar crédito negativo somando no caixa.
  assert.equal(remaining({ amount: 100, payments: [{ amount: 150 }] }), 0);
  assert.equal(remaining({ amount: 100, payments: [{ amount: 100 }] }), 0);
  assert.equal(remaining({ amount: 100, payments: [{ amount: 40 }] }), 60);
});

test("status: sem pagamento é PENDING, quitado é PAID, no meio é PARTIAL", () => {
  assert.equal(deriveStatus(100, 0), "PENDING");
  assert.equal(deriveStatus(100, 100), "PAID");
  assert.equal(deriveStatus(100, 40), "PARTIAL");
});

test("status tolera o resíduo de ponto flutuante", () => {
  // 0.1 + 0.2 = 0.30000000000000004. Sem a folga, um título de 0,30 pago
  // integralmente ficaria eternamente PARCIAL na tela.
  const pago = 0.1 + 0.2;
  assert.equal(deriveStatus(0.3, pago), "PAID");

  // E o contrário: um centavo faltando ainda é PARCIAL, não PAGO.
  assert.equal(deriveStatus(100, 99.99), "PARTIAL");
});

test("valor irrisório não transforma PENDING em PARTIAL", () => {
  assert.equal(deriveStatus(100, 0.00001), "PENDING");
});

test("parcelamento quitado fecha exatamente como PAGO", () => {
  // O caso clássico: 100 em 3 não divide. splitMoney distribui o centavo,
  // e pagar todas as parcelas tem que fechar em PAGO — não em PARCIAL por
  // um centavo perdido no caminho.
  const total = 100;
  const parcelas = splitMoney(total, 3);
  const pago = parcelas.reduce((s, v) => s + v, 0);

  assert.equal(deriveStatus(total, pago), "PAID");
  assert.equal(remaining({ amount: total, payments: parcelas.map((amount) => ({ amount })) }), 0);
});

test("parcelamento com quebra difícil também fecha", () => {
  for (const [total, partes] of [
    [1000, 7],
    [0.05, 3],
    [12345.67, 12],
    [99.99, 4],
  ] as Array<[number, number]>) {
    const parcelas = splitMoney(total, partes);
    const pago = parcelas.reduce((s, v) => s + v, 0);
    assert.equal(
      deriveStatus(total, pago),
      "PAID",
      `${total} em ${partes}x deveria fechar como PAGO`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* Vencimento                                                          */
/* ------------------------------------------------------------------ */

const emDias = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

test("título pago não tem aviso de vencimento", () => {
  assert.equal(dueInfo(emDias(-30), "PAID"), null);
});

test("vencer hoje já conta como vencido", () => {
  // É o que decide a cor vermelha e a entrada no sino de alertas.
  const hoje = dueInfo(emDias(0), "PENDING");
  assert.equal(hoje?.overdue, true);
  assert.equal(hoje?.text, "vence hoje");
});

test("ontem é vencido, amanhã não é", () => {
  const ontem = dueInfo(emDias(-1), "PENDING");
  assert.equal(ontem?.overdue, true);
  assert.equal(ontem?.text, "vencido há 1 dia");

  const amanha = dueInfo(emDias(1), "PENDING");
  assert.equal(amanha?.overdue, false);
  assert.equal(amanha?.text, "vence em 1 dia");
});

test("plural correto nos dois sentidos", () => {
  assert.equal(dueInfo(emDias(-3), "PENDING")?.text, "vencido há 3 dias");
  assert.equal(dueInfo(emDias(5), "PENDING")?.text, "vence em 5 dias");
});

test("a hora do dia não muda se está vencido", () => {
  // dueDate costuma vir à meia-noite e o "hoje" é o instante da consulta.
  // Sem zerar as horas dos dois lados, um título que vence hoje às 00:00
  // apareceria como vencido a partir de qualquer hora do dia.
  const hojeCedo = new Date();
  hojeCedo.setHours(0, 0, 0, 0);
  const info = dueInfo(hojeCedo, "PENDING");
  assert.equal(info?.text, "vence hoje");

  const hojeTarde = new Date();
  hojeTarde.setHours(23, 59, 0, 0);
  assert.equal(dueInfo(hojeTarde, "PENDING")?.text, "vence hoje");
});
