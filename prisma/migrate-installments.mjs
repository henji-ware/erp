// Migra parcelamentos do formato ANTIGO (N lançamentos "Descrição (1/6)")
// para o NOVO (1 lançamento + N parcelas).
//
// Uso:
//   node prisma/migrate-installments.mjs           # simulação (não grava nada)
//   node prisma/migrate-installments.mjs --apply   # aplica de verdade
//
// Regras: agrupa lançamentos não arquivados cujo título termina em "(i/N)",
// com mesmo texto base, tipo, cliente/fornecedor e mesmo N. Mantém o
// lançamento da parcela 1 (com seus pagamentos) e transforma os demais em
// parcelas dele. Lançamentos com pagamentos nas parcelas 2..N são pulados
// (para não perder histórico) e reportados no fim.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const rx = /^(.*)\s\((\d+)\/(\d+)\)\s*$/;

const all = await prisma.transaction.findMany({
  where: { deletedAt: null },
  include: { payments: true, installments: true },
  orderBy: { id: "asc" },
});

// Agrupa por: texto base + total de parcelas + tipo + contraparte
const groups = new Map();
for (const t of all) {
  if (t.installments.length > 0) continue; // já migrado
  const m = t.description.match(rx);
  if (!m) continue;
  const [, base, idx, total] = m;
  const key = [base.trim(), total, t.type, t.customerId ?? "-", t.supplierId ?? "-"].join("|");
  if (!groups.has(key)) groups.set(key, { base: base.trim(), total: Number(total), items: [] });
  groups.get(key).items.push({ tx: t, index: Number(idx) });
}

let migrated = 0;
const skipped = [];

for (const [, g] of groups) {
  const items = g.items.sort((a, b) => a.index - b.index);
  if (items.length < 2) continue; // nada a agrupar

  const first = items[0];
  const rest = items.slice(1);

  // Segurança: não mexe se alguma parcela 2..N já tem pagamento registrado.
  const withPayments = rest.filter((i) => i.tx.payments.length > 0);
  if (withPayments.length > 0) {
    skipped.push(`${g.base} (${items.length}/${g.total}) — parcelas já pagas: ${withPayments.map((i) => i.index).join(", ")}`);
    continue;
  }

  const total = items.reduce((s, i) => s + i.tx.amount, 0);
  console.log(
    `${APPLY ? "MIGRANDO" : "[simulação]"} "${g.base}" — ${items.length} lançamentos → 1 lançamento de ${total.toFixed(2)} com ${items.length} parcelas`,
  );

  if (APPLY) {
    await prisma.$transaction([
      // O lançamento da 1ª parcela passa a ser o lançamento único.
      prisma.transaction.update({
        where: { id: first.tx.id },
        data: { description: g.base, amount: total, dueDate: first.tx.dueDate },
      }),
      // Cronograma de parcelas.
      prisma.installment.createMany({
        data: items.map((i, n) => ({
          transactionId: first.tx.id,
          number: n + 1,
          amount: i.tx.amount,
          dueDate: i.tx.dueDate,
        })),
      }),
      // Remove os lançamentos que viraram parcelas.
      prisma.transaction.deleteMany({ where: { id: { in: rest.map((i) => i.tx.id) } } }),
    ]);

    // Reaponta os pagamentos da 1ª parcela para a parcela 1 do cronograma.
    if (first.tx.payments.length > 0) {
      const inst1 = await prisma.installment.findFirst({
        where: { transactionId: first.tx.id, number: 1 },
      });
      if (inst1) {
        await prisma.payment.updateMany({
          where: { transactionId: first.tx.id, installmentId: null },
          data: { installmentId: inst1.id },
        });
      }
    }
  }
  migrated++;
}

console.log(`\n${APPLY ? "Migrados" : "Seriam migrados"}: ${migrated} parcelamento(s).`);
if (skipped.length) {
  console.log(`\nPulados (mantidos como estão, para não perder pagamentos):`);
  skipped.forEach((s) => console.log(" - " + s));
}
if (!APPLY) console.log("\nNada foi alterado. Rode com --apply para aplicar.");

await prisma.$disconnect();
