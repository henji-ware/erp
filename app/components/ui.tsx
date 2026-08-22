import React from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  className = "bg-slate-100 text-slate-700",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export type Trend = {
  /** Variação percentual em relação ao período anterior. */
  pct: number;
  /** Ex.: "vs. mês anterior". */
  label?: string;
  /** Para métricas onde subir é ruim (a pagar, vencidos): inverte as cores. */
  invert?: boolean;
};

/** Seta do indicador de variação. */
function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={up ? "" : "rotate-180"}
    >
      <path d="M5 1.5 L9 8 L1 8 Z" fill="currentColor" />
    </svg>
  );
}

function TrendChip({ trend }: { trend: Trend }) {
  // Sem base de comparação (período anterior zerado) a porcentagem seria
  // infinita — nesse caso o honesto é dizer que é novo, não "+∞%".
  if (!Number.isFinite(trend.pct)) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
        novo
      </span>
    );
  }

  const rounded = Math.round(trend.pct);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
        estável
      </span>
    );
  }

  const up = rounded > 0;
  const good = trend.invert ? !up : up;
  const tone = good
    ? "bg-emerald-500/10 text-emerald-600"
    : "bg-red-500/10 text-red-600";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <TrendArrow up={up} />
      {up ? "+" : "−"}
      {Math.abs(rounded)}%
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "text-slate-900",
  delay = 0,
  icon,
  trend,
  spark,
  sparkClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  delay?: number;
  icon?: React.ReactNode;
  /** Variação vs. período anterior, exibida ao lado do número. */
  trend?: Trend;
  /** Série histórica desenhada no rodapé do cartão (ver <Sparkline>). */
  spark?: React.ReactNode;
  /** Cor da sparkline; por padrão acompanha a cor do número. */
  sparkClassName?: string;
}) {
  return (
    <div
      className="stat-card card hover-lift animate-fade-in-up p-5 relative overflow-hidden transition-all duration-200 accent-hover-border"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className={`stat-value text-2xl font-bold tracking-tight ${accent}`}>
              {value}
            </p>
            {trend && <TrendChip trend={trend} />}
          </div>
        </div>
        {icon && (
          <div className="shrink-0 rounded-xl bg-slate-100 p-2.5 text-slate-600">
            {icon}
          </div>
        )}
      </div>

      {hint && (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">{hint}</p>
      )}
      {trend?.label && (
        <p className="mt-1 text-[11px] text-slate-400">{trend.label}</p>
      )}

      {spark && (
        <div className={`-mx-5 -mb-5 mt-3 ${sparkClassName ?? accent}`}>{spark}</div>
      )}
    </div>
  );
}

/**
 * Variação percentual entre dois períodos.
 * Sem base (anterior = 0) devolve Infinity, que o chip mostra como "novo".
 */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : Infinity;
  return ((current - previous) / Math.abs(previous)) * 100;
}
