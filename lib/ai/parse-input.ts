// Leitura dos campos que o modelo escreve — puro, sem banco, para ter teste.
//
// Por que não dá para usar `parseMoney` (lib/money.ts) aqui: ela troca apenas
// a PRIMEIRA vírgula por ponto e chama parseFloat. Isso funciona para o que
// vem de <input type="number">, que é o caso das telas ("48000.00"), mas o
// modelo escreve como gente: "48.000,00" vira "48.000.00", e parseFloat lê
// 48. Um orçamento de quarenta e oito mil entrava como quarenta e oito reais.
//
// Além disso `parseMoney` devolve 0 para texto ("a combinar" → 0), o que aqui
// seria pior ainda: o cartão mostra "a combinar" e o registro nasce zerado.
// Estas funções devolvem `null` em vez de chutar, e quem chama vira erro.

/** Milhar em pt-BR (1.234.567) ou en-US (1,234,567). */
const GROUPED_DOT = /^\d{1,3}(\.\d{3})+$/;
const GROUPED_COMMA = /^\d{1,3}(,\d{3})+$/;

/**
 * Valor monetário escrito por um modelo. Aceita número puro e as duas
 * convenções de escrita; devolve `null` para qualquer coisa que não seja
 * inequivocamente um número.
 *
 * Ambiguidade conhecida: "1,000" é lido como mil (milhar en-US), não como
 * um vírgula zero zero zero. Três casas decimais não existem em dinheiro,
 * então milhar é a leitura certa na prática.
 */
export function parseModelMoney(v: unknown): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) ? round2(v) : null;
  }
  if (typeof v !== "string") return null;

  // Tira símbolo de moeda, espaços comuns e o espaço fino que alguns
  // modelos usam como separador de milhar (U+00A0, U+202F).
  const cleaned = v
    .replace(/R\$/gi, "")
    .replace(/[\s  ]/g, "")
    .trim();

  if (!cleaned) return null;

  const negative = cleaned.startsWith("-");
  const digits = negative ? cleaned.slice(1) : cleaned;

  // Só dígitos e separadores. "a combinar", "48k", "aprox 5000" são recusados.
  if (!/^[\d.,]+$/.test(digits)) return null;

  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  let normalized: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Tem os dois: o que aparece por último é o separador decimal.
    normalized =
      lastComma > lastDot
        ? digits.replace(/\./g, "").replace(",", ".")
        : digits.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = GROUPED_COMMA.test(digits)
      ? digits.replace(/,/g, "")
      : digits.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = GROUPED_DOT.test(digits) ? digits.replace(/\./g, "") : digits;
  } else {
    normalized = digits;
  }

  // Confere a FORMA final em vez de contar separadores: `.replace(",", ".")`
  // troca só a primeira ocorrência, então "1,2,3" sairia daqui como "1.2,3" e
  // parseFloat leria 1.2 — exatamente o tipo de leitura parcial que este
  // módulo existe para evitar. Só passa o que for um número inteiro e limpo.
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return round2(negative ? -n : n);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Id de registro escrito pelo modelo.
 *
 * Distingue três casos, e essa distinção é o ponto: "não informado" (null),
 * "informado e inválido" (undefined => quem chama devolve erro) e um id bom.
 * Antes, "clienteId": "ACME Ltda" caía no mesmo caminho de campo ausente e o
 * registro nascia sem cliente, enquanto o cartão exibia o nome.
 */
export function parseModelId(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number") {
    return Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER
      ? v
      : undefined;
  }
  if (typeof v !== "string") return undefined;

  const s = v.trim();
  if (!s) return null;
  // `parseInt` aceitaria "12abc" como 12; aqui só dígitos puros passam.
  if (!/^\d+$/.test(s)) return undefined;

  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/**
 * Valor de enum escrito pelo modelo, com sinônimos.
 *
 * NÃO tem fallback de propósito. Um `asEnum(..., "VERDE")` transformava
 * "nivelRisco": "ALTO" num laudo VERDE — o cartão mostrava ALTO, o banco
 * guardava o risco mais baixo, e ninguém via a diferença. Valor que não é
 * reconhecido devolve `undefined` e vira erro na tela.
 */
export function parseModelEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  synonyms: Record<string, T> = {},
): T | undefined {
  if (typeof v !== "string") return undefined;
  const key = v.trim().toUpperCase();
  if (!key) return undefined;
  if ((allowed as readonly string[]).includes(key)) return key as T;
  return synonyms[key];
}
