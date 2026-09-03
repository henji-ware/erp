import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function at(days, hour) {
  const d = addDays(days);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
async function pay(transactionId, amount, method, daysOffset = 0) {
  await prisma.payment.create({
    data: { transactionId, amount, method, paidAt: addDays(daysOffset) },
  });
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (process.env.SEED_CONFIRM_RESET !== "DELETE_ALL_DATA") {
    throw new Error(
      "Seed bloqueado: defina SEED_CONFIRM_RESET=DELETE_ALL_DATA para confirmar a exclusão dos dados.",
    );
  }
  if (adminPassword.length < 12 || adminPassword.length > 128) {
    throw new Error("SEED_ADMIN_PASSWORD precisa ter entre 12 e 128 caracteres.");
  }

  // Limpa em ordem segura (respeitando FKs).
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.project.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  // ---- Usuários de acesso (login) ----
  await prisma.user.create({
    data: { name: "Administrador Demo", email: "admin@example.test", passwordHash: hashPassword(adminPassword), role: "ADMIN" },
  });
  await prisma.user.create({
    data: { name: "Operador Demo", email: "operador@example.test", passwordHash: hashPassword(adminPassword), role: "USER" },
  });

  // ---- Equipe (RH) ----
  const gustavo = await prisma.employee.create({
    data: { name: "Vendedor Demo", role: "Vendedor", department: "Comercial", category: "VENDEDOR", email: "vendedor@example.test", phone: "(11) 90000-0001", contractType: "CLT", salary: 4200, commissionPct: 5, targetValue: 50000, targetQty: 8, benefits: "VR, VT, plano de saúde", hireDate: addDays(-700), active: true },
  });
  const durval = await prisma.employee.create({
    data: { name: "Representante Demo", role: "Vendedor", department: "Comercial", category: "REPRESENTANTE", email: "representante@example.test", phone: "(11) 90000-0002", contractType: "PJ", salary: 4200, commissionPct: 8, targetValue: 60000, targetQty: 10, benefits: "Vale-combustível", hireDate: addDays(-300), active: true },
  });

  // ---- Clientes fictícios ----
  const gestamp = await prisma.customer.create({ data: { name: "Empresa Alfa", company: "Empresa Alfa Logística", email: "compras@alfa.example", phone: "(11) 4000-1000", document: "11.111.111/0001-11" } });
  const localFrio = await prisma.customer.create({ data: { name: "Empresa Beta", company: "Empresa Beta Armazéns", email: "operacoes@beta.example", phone: "(11) 4000-2000" } });
  const niterra = await prisma.customer.create({ data: { name: "Empresa Gama", company: "Empresa Gama Industrial", email: "manutencao@gama.example", phone: "(11) 4000-3000" } });
  const jaguar = await prisma.customer.create({ data: { name: "Empresa Delta", company: "Empresa Delta Plásticos", email: "logistica@delta.example", phone: "(11) 4000-4000" } });
  const alambre = await prisma.customer.create({ data: { name: "Empresa Épsilon", company: "Empresa Épsilon Indústria", email: "contato@epsilon.example", phone: "(11) 4000-5000" } });
  const burigoto = await prisma.customer.create({ data: { name: "Empresa Zeta", company: "Empresa Zeta Serviços", email: "facilities@zeta.example", phone: "(11) 4000-6000" } });

  // ---- Catálogo: equipamentos, acessórios e serviços ----
  const products = await Promise.all([
    // Equipamentos
    prisma.product.create({ data: { sku: "PP-SEL", name: "Porta Paletes Seletivo", kind: "PRODUCT", category: "Equipamento", rentable: true, price: 1850, cost: 1150, stock: 240 } }),
    prisma.product.create({ data: { sku: "PP-MINI", name: "Mini Porta Paletes", kind: "PRODUCT", category: "Equipamento", rentable: true, price: 1200, cost: 720, stock: 80 } }),
    prisma.product.create({ data: { sku: "PISO-MULT", name: "Pisos Múltiplos", kind: "PRODUCT", category: "Equipamento", price: 9800, cost: 6500, stock: 12 } }),
    prisma.product.create({ data: { sku: "DIV-IND", name: "Divisórias Industriais", kind: "PRODUCT", category: "Equipamento", price: 320, cost: 190, stock: 150 } }),
    prisma.product.create({ data: { sku: "GRAD-TS", name: "Gradil de Tela Soldada", kind: "PRODUCT", category: "Equipamento", price: 180, cost: 105, stock: 300 } }),
    prisma.product.create({ data: { sku: "GRAD-NR12", name: "Gradil NR12", kind: "PRODUCT", category: "Equipamento", price: 240, cost: 140, stock: 200 } }),
    // Acessórios de Segurança
    prisma.product.create({ data: { sku: "PROT-COL", name: "Protetores de Coluna", kind: "PRODUCT", category: "Acessório de Segurança", price: 145, cost: 78, stock: 420 } }),
    prisma.product.create({ data: { sku: "PROT-CAB", name: "Protetores de Cabeceiras", kind: "PRODUCT", category: "Acessório de Segurança", price: 210, cost: 120, stock: 180 } }),
    prisma.product.create({ data: { sku: "LIM-PROF", name: "Limitador de Profundidade (Stop Horizontal)", kind: "PRODUCT", category: "Acessório de Segurança", price: 95, cost: 52, stock: 500 } }),
    prisma.product.create({ data: { sku: "TELA-AQ", name: "Telas Antiqueda", kind: "PRODUCT", category: "Acessório de Segurança", price: 130, cost: 70, stock: 260 } }),
    prisma.product.create({ data: { sku: "TELA-PROT", name: "Telas de Proteção", kind: "PRODUCT", category: "Acessório de Segurança", price: 110, cost: 60, stock: 240 } }),
    prisma.product.create({ data: { sku: "DIV-VAO", name: "Divisores de Vãos", kind: "PRODUCT", category: "Acessório de Segurança", price: 75, cost: 40, stock: 320 } }),
    // Níveis de carregamento
    prisma.product.create({ data: { sku: "PLANO-H", name: 'Plano "H"', kind: "PRODUCT", category: "Nível de Carregamento", price: 160, cost: 92, stock: 200 } }),
    prisma.product.create({ data: { sku: "PLANO-ACO", name: "Plano de Aço", kind: "PRODUCT", category: "Nível de Carregamento", price: 230, cost: 135, stock: 160 } }),
    prisma.product.create({ data: { sku: "WIRE-DECK", name: "Planos Aramados (Wire Deck)", kind: "PRODUCT", category: "Nível de Carregamento", price: 195, cost: 110, stock: 280 } }),
    prisma.product.create({ data: { sku: "TRANSV", name: "Transversinas", kind: "PRODUCT", category: "Nível de Carregamento", price: 85, cost: 47, stock: 600 } }),
    // Serviços
    prisma.product.create({ data: { sku: "SRV-ENG", name: "Projeto de Engenharia", kind: "SERVICE", category: "Serviço", price: 6500, cost: 2200, stock: 0 } }),
    prisma.product.create({ data: { sku: "SRV-INSP", name: "Inspeção e Laudo Técnico", kind: "SERVICE", category: "Serviço", price: 3200, cost: 900, stock: 0 } }),
    prisma.product.create({ data: { sku: "SRV-MONT", name: "Montagem (diária de equipe)", kind: "SERVICE", category: "Serviço", price: 2800, cost: 1400, stock: 0 } }),
    prisma.product.create({ data: { sku: "SRV-REM", name: "Remanejamento de Estruturas", kind: "SERVICE", category: "Serviço", price: 12000, cost: 6000, stock: 0 } }),
    prisma.product.create({ data: { sku: "SRV-MANUT", name: "Manutenção Preventiva", kind: "SERVICE", category: "Serviço", price: 1800, cost: 700, stock: 0 } }),
  ]);
  const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));

  // ---- Leads / Orçamentos (funil) ----
  await prisma.lead.createMany({
    data: [
      { name: "Lead Exemplo A — CD novo", email: "projetos@lead-a.example", document: "22.222.222/0001-22", source: "Site", stage: "NEW", value: 80000 },
      { name: "Lead Exemplo B — ampliação", phone: "(11) 4000-7000", document: "33.333.333/0001-33", source: "Indicação", stage: "CONTACTED", value: 150000 },
      { name: "Lead Exemplo C — galpão sul", email: "ti@lead-c.example", document: "44.444.444/0001-44", source: "Google Ads", stage: "PROPOSAL", value: 220000 },
      { name: "Lead Exemplo D — manutenção anual", source: "Cliente", stage: "WON", value: 18000 },
      { name: "Lead Exemplo E — locação", email: "compras@lead-e.example", source: "LinkedIn", stage: "LOST", value: 35000 },
    ],
  });

  // ---- Venda de equipamentos (Empresa Alfa), confirmada ----
  const items1 = [
    { product: bySku["PP-SEL"], quantity: 40 },
    { product: bySku["PROT-COL"], quantity: 24 },
    { product: bySku["WIRE-DECK"], quantity: 120 },
    { product: bySku["SRV-MONT"], quantity: 3 },
  ];
  const total1 = items1.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const order1 = await prisma.order.create({
    data: {
      number: "PED-0001",
      customerId: gestamp.id,
      sellerId: gustavo.id,
      status: "CONFIRMED",
      total: total1,
      items: { create: items1.map((i) => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })) },
    },
  });
  for (const i of items1) {
    if (i.product.kind === "SERVICE") continue;
    await prisma.product.update({ where: { id: i.product.id }, data: { stock: { decrement: i.quantity } } });
  }
  const rec1 = await prisma.transaction.create({
    data: { description: `Receita do pedido ${order1.number}`, type: "RECEIVABLE", amount: total1, dueDate: addDays(30), status: "PENDING", orderId: order1.id, customerId: gestamp.id },
  });
  await pay(rec1.id, total1 * 0.4, "PIX", -2); // entrada de 40%

  // ---- Projetos / Obras ----
  await prisma.project.create({ data: { number: "PRJ-0001", title: "Verticalização do CD — Empresa Alfa", type: "ENGENHARIA", status: "EM_EXECUCAO", customerId: gestamp.id, responsibleId: gustavo.id, value: 185000, location: "Centro de Distribuição — Cidade Exemplo/SP", startDate: addDays(-25), notes: "Projeto de verticalização +40% de posições-palete." } });
  await prisma.project.create({ data: { number: "PRJ-0002", title: "Montagem de porta-paletes — Empresa Delta", type: "MONTAGEM", status: "APROVADO", customerId: jaguar.id, responsibleId: gustavo.id, value: 92000, location: "Cidade Exemplo/SP", startDate: addDays(7) } });
  await prisma.project.create({ data: { number: "PRJ-0003", title: "Remanejamento entre unidades — Empresa Beta", type: "REMANEJAMENTO", status: "ORCAMENTO", customerId: localFrio.id, responsibleId: durval.id, value: 60000, location: "Cidade Exemplo/SP" } });
  await prisma.project.create({ data: { number: "PRJ-0004", title: "Manutenção preventiva anual — Empresa Zeta", type: "MANUTENCAO", status: "CONCLUIDO", customerId: burigoto.id, responsibleId: durval.id, value: 18000, endDate: addDays(-5) } });
  await prisma.project.create({ data: { number: "PRJ-0005", title: "Locação de porta-paletes — Empresa Épsilon", type: "LOCACAO", status: "EM_EXECUCAO", customerId: alambre.id, responsibleId: gustavo.id, value: 24000, location: "Cidade Exemplo/PR", startDate: addDays(-60) } });

  // ---- Inspeções e Laudos ----
  await prisma.inspection.create({ data: { customerId: niterra.id, location: "Galpão principal — Cidade Exemplo/SP", scheduledAt: at(-7, 9), status: "LAUDO_EMITIDO", riskLevel: "VERMELHO", engineer: "Engenheiro Demo", artNumber: "ART-SP-DEMO-001", findings: "Longarinas amassadas no nível 2 (corredor C). Risco crítico — interditar e substituir imediatamente. Colunas com folga de ancoragem." } });
  await prisma.inspection.create({ data: { customerId: jaguar.id, location: "CD — Cidade Exemplo/SP", scheduledAt: at(-2, 14), status: "REALIZADA", riskLevel: "AMARELO", engineer: "Engenheiro Demo", artNumber: "ART-SP-DEMO-002", findings: "Pontos de oxidação em montantes; reaperto e pintura anticorrosiva recomendados em 90 dias." } });
  await prisma.inspection.create({ data: { customerId: gestamp.id, location: "Centro de Distribuição — Cidade Exemplo/SP", scheduledAt: at(3, 10), status: "AGENDADA", engineer: "Engenheiro Demo" } });

  // ---- Agendamentos (visitas técnicas / reuniões) ----
  await prisma.appointment.create({ data: { title: "Visita técnica — Lead Exemplo C", type: "VISIT", startsAt: at(1, 10), status: "SCHEDULED", location: "Galpão Sul", customerId: localFrio.id, employeeId: gustavo.id } });
  await prisma.appointment.create({ data: { title: "Reunião de projeto — Empresa Delta", type: "MEETING", startsAt: at(2, 15), status: "SCHEDULED", location: "Online", customerId: jaguar.id, employeeId: durval.id } });
  await prisma.appointment.create({ data: { title: "Diagnóstico de layout — Empresa Épsilon", type: "VISIT", startsAt: at(-3, 9), status: "DONE", customerId: alambre.id, employeeId: durval.id } });

  // ---- Fornecedores ----
  const acoForte = await prisma.supplier.create({ data: { name: "Fornecedor Alfa", document: "55.555.555/0001-55", email: "vendas@fornecedor-alfa.example", phone: "(11) 4000-8000" } });
  const fixadores = await prisma.supplier.create({ data: { name: "Fornecedor Beta", email: "comercial@fornecedor-beta.example", phone: "(11) 4000-9000" } });

  // ---- Contas a pagar ----
  await prisma.transaction.create({ data: { description: "Aluguel do galpão / escritório", type: "PAYABLE", amount: 8500, dueDate: addDays(10), status: "PENDING" } });
  const pay1 = await prisma.transaction.create({ data: { description: "Compra de aço — lote estrutural", type: "PAYABLE", amount: 42000, dueDate: addDays(20), status: "PENDING", supplierId: acoForte.id } });
  await pay(pay1.id, 20000, "BOLETO", -1); // pagamento parcial
  const pay2 = await prisma.transaction.create({ data: { description: "Parafusos e fixadores", type: "PAYABLE", amount: 3800, dueDate: addDays(-3), status: "PENDING", supplierId: fixadores.id } });
  await pay(pay2.id, 3800, "PIX", -3);

  // Recalcula o status (PENDING/PARTIAL/PAID) conforme os pagamentos.
  const allTx = await prisma.transaction.findMany({ include: { payments: true } });
  for (const t of allTx) {
    const paid = t.payments.reduce((s, p) => s + p.amount, 0);
    const status = paid <= 0.0001 ? "PENDING" : paid + 0.0001 >= t.amount ? "PAID" : "PARTIAL";
    if (status !== t.status) await prisma.transaction.update({ where: { id: t.id }, data: { status } });
  }

  console.log("Seed DRR concluído:");
  console.log("  Logins: admin@example.test e operador@example.test");
  console.log("  Senha: valor informado em SEED_ADMIN_PASSWORD (não exibido)");
  console.log("  Clientes:", await prisma.customer.count());
  console.log("  Funcionários:", await prisma.employee.count());
  console.log("  Equip./Serviços:", await prisma.product.count());
  console.log("  Projetos:", await prisma.project.count());
  console.log("  Inspeções:", await prisma.inspection.count());
  console.log("  Pedidos:", await prisma.order.count());
  console.log("  Agendamentos:", await prisma.appointment.count());
  console.log("  Lançamentos:", await prisma.transaction.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
