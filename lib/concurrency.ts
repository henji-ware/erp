// Detecção de edição concorrente ("lost update").
//
// O ERP é multiusuário e o mesmo registro é editado por mais de uma pessoa:
// dois vendedores na mesma proposta, o técnico e o administrativo na mesma
// inspeção. Sem nenhuma verificação, quem salvar por último sobrescreve o
// trabalho do outro em silêncio — sem aviso e sem desfazer.
//
// A regra é bloqueio otimista: o formulário leva junto o `updatedAt` que ele
// carregou, e a gravação compara com o que está no banco. Se mudou no meio do
// caminho, alguém salvou primeiro e a gravação é recusada.

/** Nome do campo escondido que os formulários enviam. */
export const VERSION_FIELD = "__updatedAt";

/**
 * O valor enviado pelo formulário ainda corresponde ao do banco?
 *
 * Tolera 1000ms de diferença: o `DateTime` do Postgres tem microssegundos, o
 * ISO string leva milissegundos, e um round-trip pode truncar. Sem a folga a
 * comparação acusaria conflito onde não houve.
 */
export function isStale(
  submitted: unknown,
  current: Date | null | undefined,
  toleranceMs = 1000,
): boolean {
  // Sem carimbo no banco não há como comparar — deixa passar em vez de
  // travar a edição de registros anteriores à migração.
  if (!current) return false;

  // Formulário antigo (ou requisição feita à mão) sem o campo: também passa.
  // A guarda protege contra sobrescrita acidental, não é controle de acesso —
  // quem quer burlar já tem a server action à disposição.
  if (typeof submitted !== "string" || !submitted.trim()) return false;

  const enviado = new Date(submitted);
  if (Number.isNaN(enviado.getTime())) return false;

  return current.getTime() - enviado.getTime() > toleranceMs;
}

/** Valor a colocar no campo escondido do formulário. */
export function versionValue(updatedAt: Date | null | undefined): string {
  return updatedAt ? updatedAt.toISOString() : "";
}
