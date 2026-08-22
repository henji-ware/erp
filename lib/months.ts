// Agrupamento por mês — puro, sem banco, para poder ser testado isolado.
// A aritmética de mês é a parte que quebra em silêncio (virada de ano,
// mês com menos dias), então mora aqui e tem teste.

export const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Chave de agrupamento mensal (ano + mês, no fuso local). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function monthLabel(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Os últimos `count` meses incluindo o atual, do mais antigo para o mais
 * recente. `start` é sempre o dia 1º — é o que garante que o mês mais antigo
 * entre inteiro na janela, e não pela metade.
 *
 * Usa `new Date(ano, mês - i, 1)`, que normaliza índice negativo virando o
 * ano sozinho: mês -1 de 2026 é dezembro de 2025.
 */
export function lastMonths(
  count: number,
  ref: Date = new Date(),
): { key: string; label: string; start: Date }[] {
  const out: { key: string; label: string; start: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: monthLabel(d), start: d });
  }
  return out;
}
