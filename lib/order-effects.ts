// Efeitos de confirmar e de cancelar um pedido: estoque e cobrança.
//
// Ficam aqui, e não dentro de app/orders/actions.ts, por um motivo prático:
// aquele arquivo é "use server" e importa next/cache, então um teste que o
// carregasse arrastaria o runtime do Next junto. Aqui a única dependência é o
// cliente do banco, que chega COMO PARÂMETRO — o que permite exercitar as
// regras com um duplo em memória, sem precisar de Postgres no CI.
//
// É o caminho que move dinheiro e estoque do sistema. Um erro aqui não trava
// tela nenhuma: grava um número errado que só aparece no fechamento do mês.

import type { Prisma, StockReason, TransactionStatus } from "@prisma/client";

/** Quem provocou o movimento, para a linha do razão de estoque. */
export interface ActorInfo {
  id: number | null;
  name: string | null;
}

/**
 * O subconjunto do cliente Prisma que estes efeitos usam.
 *
 * Declarar o mínimo (em vez de `Prisma.TransactionClient` inteiro) é o que
 * torna o duplo de teste viável: implementar cinco métodos, não a API toda.
 */
export interface OrderEffectsDb {
  order: {
    findUnique(args: {
      where: { id: number };
      include: {
        items: { include: { product: true } };
        transactions?: true;
      };
    }): Promise<OrderWithItems | null>;
  };
  product: {
    update(args: {
      where: { id: number };
      data: { stock: { decrement: number } | { increment: number } };
    }): Promise<{ id: number; stock: number }>;
  };
  stockMovement: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  transaction: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    deleteMany(args: {
      where: { orderId: number; status: TransactionStatus };
    }): Promise<unknown>;
  };
}

export interface OrderWithItems {
  id: number;
  number: string;
  total: number;
  customerId: number;
  ownerId: number | null;
  items: Array<{
    productId: number;
    quantity: number;
    product: { kind: string };
  }>;
  transactions?: Array<{ id: number }>;
}

/** O cliente real do Prisma satisfaz a interface acima. */
export type RealDb = Prisma.TransactionClient;

export const RECEIVABLE_DUE_DAYS = 30;

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Pedido entrou em vigor: baixa o estoque dos produtos e abre a cobrança.
 *
 * `now` é injetável para o teste não depender do relógio.
 */
export async function applyConfirm(
  db: OrderEffectsDb,
  orderId: number,
  now: Date = new Date(),
  actor: ActorInfo = { id: null, name: null },
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, transactions: true },
  });
  if (!order) return;

  for (const it of order.items) {
    // Serviço não tem estoque: baixar geraria saldo negativo em algo que não
    // existe fisicamente (montagem, inspeção, mão de obra).
    if (it.product.kind === "SERVICE") continue;
    const updated = await db.product.update({
      where: { id: it.productId },
      data: { stock: { decrement: it.quantity } },
    });
    await recordMovement(db, {
      productId: it.productId,
      quantity: -it.quantity,
      balance: updated.stock,
      reason: "ORDER_CONFIRM",
      orderId: order.id,
      note: `Pedido ${order.number}`,
      actor,
    });
  }

  // Só abre cobrança se ainda não houver: DRAFT -> CONFIRMED -> INVOICED
  // passa por aqui mais de uma vez, e sem esta guarda o cliente receberia
  // dois títulos pelo mesmo pedido.
  if ((order.transactions?.length ?? 0) === 0) {
    await db.transaction.create({
      data: {
        description: `Receita do pedido ${order.number}`,
        type: "RECEIVABLE",
        amount: order.total,
        dueDate: addDays(now, RECEIVABLE_DUE_DAYS),
        status: "PENDING",
        orderId: order.id,
        customerId: order.customerId,
        ownerId: order.ownerId,
      },
    });
  }
}

/**
 * Pedido saiu de vigor (cancelado): devolve o estoque e retira a cobrança.
 *
 * Só apaga títulos PENDING. Um título PARCIAL ou PAGO representa dinheiro que
 * entrou de verdade — apagá-lo sumiria com o pagamento do cliente do caixa.
 */
export async function reverseConfirm(
  db: OrderEffectsDb,
  orderId: number,
  actor: ActorInfo = { id: null, name: null },
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return;

  for (const it of order.items) {
    if (it.product.kind === "SERVICE") continue;
    const updated = await db.product.update({
      where: { id: it.productId },
      data: { stock: { increment: it.quantity } },
    });
    await recordMovement(db, {
      productId: it.productId,
      quantity: it.quantity,
      balance: updated.stock,
      reason: "ORDER_REVERSE",
      orderId: order.id,
      note: `Cancelamento do pedido ${order.number}`,
      actor,
    });
  }

  await db.transaction.deleteMany({ where: { orderId, status: "PENDING" } });
}

/**
 * Uma linha no razão de estoque.
 *
 * `balance` é o saldo DEPOIS do movimento. Guardar isso (em vez de recalcular
 * somando tudo) é o que permite conferir a sequência: se o saldo de uma linha
 * não bate com o anterior mais a quantidade, houve escrita fora do razão.
 */
async function recordMovement(
  db: OrderEffectsDb,
  m: {
    productId: number;
    quantity: number;
    balance: number;
    reason: StockReason;
    note?: string;
    orderId?: number | null;
    supplierId?: number | null;
    unitCost?: number | null;
    actor: ActorInfo;
  },
): Promise<void> {
  await db.stockMovement.create({
    data: {
      productId: m.productId,
      quantity: m.quantity,
      balance: m.balance,
      reason: m.reason,
      note: m.note ?? null,
      orderId: m.orderId ?? null,
      supplierId: m.supplierId ?? null,
      unitCost: m.unitCost ?? null,
      userId: m.actor.id,
      userName: m.actor.name,
    },
  });
}
