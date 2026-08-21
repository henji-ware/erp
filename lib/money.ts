export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseMoney(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return roundMoney(parsed);
}

// Divide em centavos inteiros para garantir que a soma das parcelas seja
// exatamente igual ao total, sem resíduos de ponto flutuante.
export function splitMoney(total: number, parts: number): number[] {
  const count = Math.max(1, Math.floor(parts));
  const cents = Math.round(roundMoney(total) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) =>
    (base + (index >= count - remainder ? 1 : 0)) / 100,
  );
}

