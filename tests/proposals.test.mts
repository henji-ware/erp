import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currencyInWords,
  proposalPrice,
  proposalNumber,
  parseFindings,
  damageClass,
} from "../lib/proposals.ts";

/**
 * Tudo aqui sai impresso na proposta que vai para o cliente. Um erro no
 * extenso ou na soma não quebra tela nenhuma — vira um documento assinado
 * com o número errado.
 */

/* ------------------------------------------------------------------ */
/* Valor por extenso                                                   */
/* ------------------------------------------------------------------ */

test("extenso: os casos que a gramática trata de forma especial", () => {
  // "cem" sozinho, "cento" quando acompanhado — é o erro clássico.
  assert.match(currencyInWords(100), /^cem reais$/i);
  assert.match(currencyInWords(101), /^cento e um reais$/i);

  assert.match(currencyInWords(1), /^um real$/i);
  assert.match(currencyInWords(2), /^dois reais$/i);
});

test("extenso: mil não vira 'um mil'", () => {
  assert.match(currencyInWords(1000), /^mil reais$/i);
  assert.match(currencyInWords(2000), /^dois mil reais$/i);
});

test("extenso: centavos entram como fração", () => {
  const texto = currencyInWords(1234.56).toLowerCase();
  assert.ok(texto.includes("centavo"), `deveria citar centavos: "${texto}"`);
  assert.ok(
    texto.includes("mil") && texto.includes("duzentos"),
    `deveria escrever a parte inteira: "${texto}"`,
  );
});

test("extenso: zero e valores altos não quebram", () => {
  assert.equal(typeof currencyInWords(0), "string");
  assert.ok(currencyInWords(0).length > 0);

  const milhao = currencyInWords(1_000_000).toLowerCase();
  assert.ok(milhao.includes("milh"), `deveria citar milhão: "${milhao}"`);
});

test("extenso: arredonda para duas casas em vez de listar dízima", () => {
  const texto = currencyInWords(0.1 + 0.2).toLowerCase();
  assert.ok(
    texto.includes("trinta"),
    `0,30 deveria virar trinta centavos: "${texto}"`,
  );
});

/* ------------------------------------------------------------------ */
/* Composição do preço                                                 */
/* ------------------------------------------------------------------ */

const base = {
  amount: 0,
  laborAmount: 0,
  equipmentAmount: 0,
  freightAmount: 0,
};

test("preço soma mão de obra, equipamento, frete e componentes", () => {
  const p = proposalPrice(
    { ...base, amount: 1000, laborAmount: 500, equipmentAmount: 200, freightAmount: 50 },
    0,
    false,
  );
  assert.equal(p.total, 1750);
  assert.equal(p.components, 1000);
});

test("com itens no orçamento, o componente vem da soma dos itens", () => {
  // O campo "Componentes" fica bloqueado na tela quando há itens; aqui é a
  // regra por trás disso. Se o valor digitado vencesse a soma, a proposta
  // sairia com um total que não bate com a lista de itens.
  const p = proposalPrice(
    { ...base, amount: 999999, laborAmount: 100 },
    4200,
    true,
  );
  assert.equal(p.components, 4200, "a soma dos itens tem que vencer");
  assert.equal(p.total, 4300);
});

test("sem itens, vale o valor digitado", () => {
  const p = proposalPrice({ ...base, amount: 777 }, 4200, false);
  assert.equal(p.components, 777);
  assert.equal(p.total, 777);
});

/* ------------------------------------------------------------------ */
/* Numeração                                                           */
/* ------------------------------------------------------------------ */

test("número da proposta formata a obra e marca a revisão", () => {
  // A numeração da DRR é AA + sequencial; na proposta sai como "26.194".
  const n = proposalNumber("26194", 0, "INSPECAO");
  assert.ok(n.includes("26.194"), `deveria pontuar a obra: "${n}"`);
  assert.ok(n.endsWith("-R0"), `deveria marcar a revisão: "${n}"`);

  assert.ok(proposalNumber("26194", 3, "INSPECAO").endsWith("-R3"));
});

test("orçamento sem número não inventa um", () => {
  const n = proposalNumber(null, 1, "INSPECAO");
  assert.ok(n.includes("—"), `deveria indicar ausência: "${n}"`);
});

test("número curto passa sem pontuação", () => {
  const n = proposalNumber("42", 0, "INSPECAO");
  assert.ok(n.includes("42"));
  assert.ok(!n.includes("."), `número curto não deve ganhar ponto: "${n}"`);
});

/* ------------------------------------------------------------------ */
/* Tabela de não conformidades                                         */
/* ------------------------------------------------------------------ */

test("lê linhas separadas por TAB (colagem do Excel)", () => {
  const linhas = parseFindings(
    "A\t25\t7\tMetalshop\tLongarina\tMédia\tReposicionar\n" +
      "B\t12\t3\t\tMontante\tGrave\tTrocar",
  );

  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas[0], {
    aisle: "A",
    location: "25",
    level: "7",
    maker: "Metalshop",
    component: "Longarina",
    damage: "Média",
    action: "Reposicionar",
  });
  assert.equal(linhas[1].maker, "", "coluna vazia continua vazia");
});

test("aceita pipe como separador alternativo", () => {
  const linhas = parseFindings("A|25|7|Metalshop|Longarina|Leve|Monitorar");
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].component, "Longarina");
});

test("descarta a linha de cabeçalho colada junto", () => {
  const linhas = parseFindings(
    "RUA\tLOCALIZAÇÃO\tNÍVEL\tFABRICANTE\tCOMPONENTE\tDANO\tAÇÃO\n" +
      "A\t25\t7\tMetalshop\tLongarina\tMédia\tReposicionar",
  );
  assert.equal(linhas.length, 1, "o cabeçalho não pode virar não conformidade");
  assert.equal(linhas[0].aisle, "A");
});

test("linhas em branco são ignoradas", () => {
  const linhas = parseFindings("A\t1\t2\t\t\tLeve\t\n\n   \n\nB\t3\t4\t\t\tGrave\t");
  assert.equal(linhas.length, 2);
});

test("campo vazio ou nulo devolve lista vazia", () => {
  assert.deepEqual(parseFindings(null), []);
  assert.deepEqual(parseFindings(""), []);
  assert.deepEqual(parseFindings("\n\n"), []);
});

test("a cor da célula segue a gravidade, com e sem acento", () => {
  // É o que pinta a tabela impressa; "media" sem acento é o que mais chega
  // de planilha.
  assert.match(damageClass("Grave"), /red/);
  assert.match(damageClass("grave"), /red/);
  assert.match(damageClass("Falta"), /amber/);
  assert.match(damageClass("Média"), /amber|yellow/);
  assert.match(damageClass("media"), /amber|yellow/);
  assert.equal(damageClass("Leve"), "", "leve não recebe destaque");
  assert.equal(damageClass(""), "");
});
