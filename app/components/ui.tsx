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

export function StatCard({
  label,
  value,
  hint,
  accent = "text-slate-900 dark:text-white",
  delay = 0,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  delay?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="card hover-lift animate-fade-in-up p-5 relative overflow-hidden transition-all duration-200 hover:border-brand-500/30"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${accent}`}>{value}</p>
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">{hint}</p>}
    </div>
  );
}

export function LiveBadge({
  children,
  color = "emerald",
}: {
  children: React.ReactNode;
  color?: "emerald" | "amber" | "red" | "blue" | "indigo";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 dot-emerald-500",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 dot-amber-500",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800 dot-red-500",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 dot-blue-500",
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 dot-indigo-500",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorMap[color] || colorMap.emerald}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {children}
    </span>
  );
}
