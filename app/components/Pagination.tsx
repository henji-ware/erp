import Link from "next/link";
import { Icon } from "./icons";
import { listPageHref } from "@/lib/list-navigation";

// Navegação de páginas para as listagens. Preserva os filtros atuais
// (ex.: ?q=...) ao trocar de página.
export function Pagination({
  basePath,
  page,
  totalPages,
  from,
  to,
  total,
  params = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  if (total === 0) return null;

  const href = (p: number) => listPageHref(basePath, p, params);

  return (
    <nav aria-label="Paginação da listagem" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
      <p className="text-slate-500">
        {from}–{to} de <span className="font-medium text-slate-700">{total}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 2 && <Link href={href(1)} className="btn-ghost px-2 py-1 text-xs" aria-label="Primeira página">1</Link>}
          {page > 1 ? (
            <Link href={href(page - 1)} className="btn-ghost px-2 py-1" aria-label="Página anterior">
              <Icon name="chevronLeft" size={16} />
            </Link>
          ) : (
            <span className="btn-ghost cursor-not-allowed px-2 py-1 opacity-40">
              <Icon name="chevronLeft" size={16} />
            </span>
          )}
          <span className="text-slate-500">
            Página <span className="font-medium text-slate-700">{page}</span> de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href(page + 1)} className="btn-ghost px-2 py-1" aria-label="Próxima página">
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : (
            <span className="btn-ghost cursor-not-allowed px-2 py-1 opacity-40">
              <Icon name="chevronRight" size={16} />
            </span>
          )}
          {page < totalPages - 1 && <Link href={href(totalPages)} className="btn-ghost px-2 py-1 text-xs" aria-label="Última página">{totalPages}</Link>}
        </div>
      )}
    </nav>
  );
}
