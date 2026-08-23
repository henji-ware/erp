import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyConfirm,
  reverseConfirm,
  RECEIVABLE_DUE_DAYS,
  type OrderEffectsDb,
  type OrderWithItems,
} from "../lib/order-effects.ts";

/**
 * Duplo em memória do cliente Prisma.
 *
 * `applyConfirm`/`reverseConfirm` recebem o banco como parâmetro, então dá
 * para exercitar as regras de estoque e cobrança sem Postgres — o que
 * importa aqui é a ARITMÉTICA, não o driver.
 */
function makeDb(seed: {
  order?: OrderWithItems | null;
  stock?: Record<number, number>;
  transactions?: Array<{ id: number; orderId: number; status: string }>;
}) {
  const stock: Record<number, number> = { ...(seed.stock ?? {}) };
  const transactions = [...(seed.transactions ?? [])];
  const created: Array<Record<string, unknown>> = [];
  const movimentos: Array<Record<string, unknown>> = [];
  let nextId = 900;

  const db: OrderEffectsDb = {
    order: {
      async findUnique() {
        if (!seed.order) return null;
        // A consulta real traz os títulos junto; o duplo reflete o estado
        // atual, que é o que a guarda de idempotência consulta.
        return {
          ...seed.order,
          transactions: transactions.filter((t) => t.orderId === seed.order!.id),
        };
      },
    },
    product: {
      async update({ where, data }) {
        const current = stock[where.id] ?? 0;
        stock[where.id] =
          "decrement" in data.stock
            ? current - data.stock.decrement
            : current + data.stock.increment;
        // Devolve a linha atualizada, como o Prisma faz: é daí que sai o
        // saldo gravado no razão.
        return { id: where.id, stock: stock[where.id] };
      },
    },
    stockMovement: {
      async create({ data }) {
        movimentos.push(data);
        return null;
      },
    },
    transaction: {
      async create({ data }) {
        created.push(data);
        transactions.push({
          id: nextId++,
          orderId: Number(data.orderId),
          status: String(data.status),
        });
        return null;
      },
      async deleteMany({ where }) {
        for (let i = transactions.length - 1; i >= 0; i--) {
          const t = transactions[i];
          if (t.orderId === where.orderId && t.status === where.status) {
            transactions.splice(i, 1);
          }
        }
        return null;
      },
    },
  };

  return { db, stock, transactions, created, movimentos };
}

const PRODUTO = { kind: "PRODUCT" };
const SERVICO = { kind: "SERVICE" };

function pedido(items: OrderWithItems["items"], total = 1000): OrderWithItems {
  return {
    id: 1,
    number: "PED-TESTE",
    total,
    customerId: 7,
    ownerId: 3,
    items,
  };
}

/* ------------------------------------------------------------------ */
/* Confirmação                                                         */
/* ------------------------------------------------------------------ */

test("confirmar baixa o estoque dos produtos", () => {
  const { db, stock } = makeDb({
    order: pedido([
      { productId: 10, quantity: 4, product: PRODUTO },
      { productId: 11, quantity: 2, product: PRODUTO },
    ]),
    stock: { 10: 50, 11: 5 },
  });

  return applyConfirm(db, 1).then(() => {
    assert.equal(stock[10], 46);
    assert.equal(stock[11], 3);
  });
});

test("serviço não mexe em estoque", async () => {
  // Montagem e inspeção não têm unidade física: baixar geraria saldo
  // negativo em algo que não existe no depósito.
  const { db, stock } = makeDb({
    order: pedido([
      { productId: 10, quantity: 3, product: PRODUTO },
      { productId: 99, quantity: 8, product: SERVICO },
    ]),
    stock: { 10: 20, 99: 0 },
  });

  await applyConfirm(db, 1);
  assert.equal(stock[10], 17);
  assert.equal(stock[99], 0, "estoque de serviço tem que ficar intacto");
});

test("confirmar abre a cobrança com o total do pedido", async () => {
  const { db, created } = makeDb({
    order: pedido([{ productId: 10, quantity: 1, product: PRODUTO }], 4321.5),
    stock: { 10: 10 },
  });

  const hoje = new Date(2026, 2, 10);
  await applyConfirm(db, 1, hoje);

  assert.equal(created.length, 1);
  const tx = created[0];
  assert.equal(tx.type, "RECEIVABLE");
  assert.equal(tx.amount, 4321.5);
  assert.equal(tx.status, "PENDING");
  assert.equal(tx.orderId, 1);
  assert.equal(tx.customerId, 7);
  assert.equal(tx.ownerId, 3, "o título herda o dono do pedido, para o escopo");

  const venc = tx.dueDate as Date;
  const esperado = new Date(hoje);
  esperado.setDate(esperado.getDate() + RECEIVABLE_DUE_DAYS);
  assert.equal(venc.getTime(), esperado.getTime());
});

test("passar por CONFIRMED e depois INVOICED não duplica a cobrança", async () => {
  // Este é o caminho normal de um pedido faturado. Sem a guarda de
  // idempotência o cliente receberia DOIS títulos pelo mesmo pedido.
  const { db, created, stock } = makeDb({
    order: pedido([{ productId: 10, quantity: 2, product: PRODUTO }]),
    stock: { 10: 100 },
  });

  await applyConfirm(db, 1);
  await applyConfirm(db, 1);

  assert.equal(created.length, 1, "só um título pode existir");
  // O estoque, por outro lado, baixa a cada chamada — é por isso que
  // orderTransitionEffect só devolve APPLY ao CRUZAR a fronteira ativa.
  assert.equal(stock[10], 96);
});

test("pedido inexistente não explode nem escreve nada", async () => {
  const { db, created } = makeDb({ order: null, stock: { 10: 5 } });
  await applyConfirm(db, 404);
  assert.equal(created.length, 0);
});

/* ------------------------------------------------------------------ */
/* Cancelamento                                                        */
/* ------------------------------------------------------------------ */

test("cancelar devolve o estoque", async () => {
  const { db, stock } = makeDb({
    order: pedido([
      { productId: 10, quantity: 4, product: PRODUTO },
      { productId: 11, quantity: 1, product: SERVICO },
    ]),
    stock: { 10: 46, 11: 0 },
  });

  await reverseConfirm(db, 1);
  assert.equal(stock[10], 50);
  assert.equal(stock[11], 0, "serviço continua fora do estoque na volta");
});

test("cancelar apaga só o título em aberto", async () => {
  // Um título PARCIAL representa dinheiro que o cliente já pagou. Apagar
  // sumiria com esse pagamento do caixa.
  const { db, transactions } = makeDb({
    order: pedido([{ productId: 10, quantity: 1, product: PRODUTO }]),
    stock: { 10: 9 },
    transactions: [
      { id: 1, orderId: 1, status: "PENDING" },
      { id: 2, orderId: 1, status: "PARTIAL" },
      { id: 3, orderId: 1, status: "PAID" },
      { id: 4, orderId: 2, status: "PENDING" },
    ],
  });

  await reverseConfirm(db, 1);

  assert.deepEqual(
    transactions.map((t) => t.id).sort(),
    [2, 3, 4],
    "só o PENDING do pedido 1 sai",
  );
});

test("confirmar e cancelar devolve o estoque ao valor original", async () => {
  const inicial = 37;
  const { db, stock } = makeDb({
    order: pedido([{ productId: 10, quantity: 12, product: PRODUTO }]),
    stock: { 10: inicial },
  });

  await applyConfirm(db, 1);
  assert.equal(stock[10], inicial - 12);
  await reverseConfirm(db, 1);
  assert.equal(stock[10], inicial, "o ciclo completo não pode deixar resíduo");
});

test("o mesmo produto em duas linhas baixa as duas", async () => {
  const { db, stock } = makeDb({
    order: pedido([
      { productId: 10, quantity: 3, product: PRODUTO },
      { productId: 10, quantity: 5, product: PRODUTO },
    ]),
    stock: { 10: 20 },
  });

  await applyConfirm(db, 1);
  assert.equal(stock[10], 12);
});

/* ------------------------------------------------------------------ */
/* Comportamento hoje conhecido                                        */
/* ------------------------------------------------------------------ */

test("confirmar acima do saldo deixa o estoque NEGATIVO", async () => {
  // Documenta o comportamento atual: não existe reserva nem trava de saldo.
  // Se isso virar regra de negócio ("não confirmar sem estoque"), este teste
  // é o lugar de mudar — e vai falhar avisando.
  const { db, stock } = makeDb({
    order: pedido([{ productId: 10, quantity: 100, product: PRODUTO }]),
    stock: { 10: 5 },
  });

  await applyConfirm(db, 1);
  assert.equal(stock[10], -95);
});

/* ------------------------------------------------------------------ */
/* Razão de estoque                                                    */
/* ------------------------------------------------------------------ */

test("confirmar grava uma linha no razão por produto", async () => {
  const { db, movimentos } = makeDb({
    order: pedido([
      { productId: 10, quantity: 4, product: PRODUTO },
      { productId: 11, quantity: 2, product: PRODUTO },
      { productId: 99, quantity: 1, product: SERVICO },
    ]),
    stock: { 10: 50, 11: 5 },
  });

  await applyConfirm(db, 1, new Date(), { id: 7, name: "Gustavo" });

  assert.equal(movimentos.length, 2, "serviço não gera movimento");
  assert.equal(movimentos[0].productId, 10);
  assert.equal(movimentos[0].quantity, -4, "saída é negativa");
  assert.equal(movimentos[0].reason, "ORDER_CONFIRM");
  assert.equal(movimentos[0].orderId, 1);
  assert.equal(movimentos[0].userId, 7);
  assert.equal(movimentos[0].userName, "Gustavo");
});

test("o saldo gravado no razão é o de DEPOIS do movimento", async () => {
  // É o que permite auditar a sequência sem somar o histórico inteiro: se o
  // saldo de uma linha não bate com o anterior mais a quantidade, alguém
  // escreveu em Product.stock por fora do razão.
  const { db, movimentos, stock } = makeDb({
    order: pedido([{ productId: 10, quantity: 12, product: PRODUTO }]),
    stock: { 10: 37 },
  });

  await applyConfirm(db, 1);
  assert.equal(movimentos[0].balance, 25);
  assert.equal(stock[10], 25, "o razão tem que bater com o saldo do produto");
});

test("cancelar grava a devolução como entrada", async () => {
  const { db, movimentos } = makeDb({
    order: pedido([{ productId: 10, quantity: 4, product: PRODUTO }]),
    stock: { 10: 46 },
  });

  await reverseConfirm(db, 1, { id: 7, name: "Gustavo" });

  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].quantity, 4, "entrada é positiva");
  assert.equal(movimentos[0].balance, 50);
  assert.equal(movimentos[0].reason, "ORDER_REVERSE");
});

test("o ciclo confirma-cancela deixa duas linhas que se anulam", async () => {
  const { db, movimentos } = makeDb({
    order: pedido([{ productId: 10, quantity: 9, product: PRODUTO }]),
    stock: { 10: 20 },
  });

  await applyConfirm(db, 1);
  await reverseConfirm(db, 1);

  assert.equal(movimentos.length, 2);
  const soma = movimentos.reduce((s, m) => s + Number(m.quantity), 0);
  assert.equal(soma, 0, "as quantidades têm que se anular");
  assert.equal(movimentos[1].balance, 20, "e o saldo volta ao original");
});

test("sem usuário identificado o movimento ainda é gravado", async () => {
  // Cron e rotinas internas não têm sessão; perder o movimento seria pior
  // que perder o nome de quem o causou.
  const { db, movimentos } = makeDb({
    order: pedido([{ productId: 10, quantity: 1, product: PRODUTO }]),
    stock: { 10: 5 },
  });

  await applyConfirm(db, 1);
  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].userId, null);
  assert.equal(movimentos[0].userName, null);
});
