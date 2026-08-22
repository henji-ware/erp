// Blocos de carregamento usados pelos loading.tsx de cada módulo.
//
// A ideia é o esqueleto ter o MESMO formato da página real (mesmo número de
// KPIs, mesma altura de tabela): assim o conteúdo não "pula" quando chega.

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Título + subtítulo + botão de ação, no formato do <PageHeader>. */
export function SkeletonHeader({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <SkeletonBlock className="h-7 w-52" />
        <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
      </div>
      {action && <SkeletonBlock className="h-9 w-full rounded-lg sm:w-64" />}
    </div>
  );
}

/** Grade de <StatCard>. */
export function SkeletonStats({
  count = 4,
  cols = "sm:grid-cols-2 lg:grid-cols-4",
  className = "",
}: {
  count?: number;
  cols?: string;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${cols} ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-3 h-7 w-28" />
            </div>
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cartão com cabeçalho e linhas de tabela. */
export function SkeletonTable({
  rows = 6,
  cols = 4,
  title = true,
  className = "",
}: {
  rows?: number;
  cols?: number;
  title?: boolean;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: cols }, (_, c) => (
              <SkeletonBlock
                key={c}
                // A primeira coluna é o nome (mais larga); a última costuma ser
                // valor/data alinhado à direita.
                className={`h-4 ${c === 0 ? "w-1/3" : c === cols - 1 ? "ml-auto w-20" : "w-1/6"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barra de busca + filtros. */
export function SkeletonFilters() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SkeletonBlock className="h-9 w-full max-w-xs rounded-lg" />
      <SkeletonBlock className="h-9 w-28 rounded-lg" />
    </div>
  );
}

/** Cartão de formulário “Novo …” que abre no topo das listagens. */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="card mb-6 p-5">
      <SkeletonBlock className="mb-4 h-4 w-32" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i}>
            <SkeletonBlock className="mb-1.5 h-3 w-16" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Esqueleto padrão de uma listagem: cabeçalho, filtros, formulário e tabela.
 * Cobre a maioria dos módulos; quem foge do padrão monta o seu.
 */
export function SkeletonList({
  stats = 0,
  filters = false,
  form = true,
  rows = 8,
  cols = 5,
}: {
  stats?: number;
  filters?: boolean;
  form?: boolean;
  rows?: number;
  cols?: number;
}) {
  return (
    <div>
      <SkeletonHeader />
      {stats > 0 && <SkeletonStats count={stats} className="mb-6" />}
      {filters && <SkeletonFilters />}
      {form && <SkeletonForm />}
      <SkeletonTable rows={rows} cols={cols} />
    </div>
  );
}
