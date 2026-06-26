// Paginação simples para as listagens (server components).

export const PAGE_SIZE = 20;

// Lê o número da página a partir do query param (?page=2). Sempre >= 1.
export function parsePage(value: string | undefined): number {
  const n = parseInt(String(value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// A partir do total de registros e da página atual, devolve os parâmetros
// prontos para o Prisma (skip/take) e os metadados para a UI.
export function paginate(total: number, page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    skip: (current - 1) * pageSize,
    take: pageSize,
    page: current,
    totalPages,
    total,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, total),
  };
}
