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
  accent = "text-slate-900",
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
      className="card hover-lift animate-fade-in-up p-5 relative overflow-hidden transition-all duration-200 accent-hover-border"
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
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
            {icon}
          </div>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">{hint}</p>}
    </div>
  );
}

