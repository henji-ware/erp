"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export type BellItem = {
  section: string;
  href: string;
  label: string;
  when: string; // texto pronto ("vence hoje", "faltam 2 dias"…)
  overdue: boolean;
};

// Sino de avisos: mesmos prazos do e-mail diário, dentro do sistema.
export default function NotificationBell({ items }: { items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const overdue = items.filter((i) => i.overdue).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Avisos"
        title="Avisos de prazo"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <Icon name="calendar" size={18} />
        {items.length > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              overdue > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-800">
              Prazos {items.length > 0 && <span className="text-slate-400">({items.length})</span>}
            </p>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Nada vencendo nos próximos dias. 🎉
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((it, i) => (
                <li key={i} className="border-b border-slate-50 last:border-0">
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {it.section}
                    </p>
                    <p className="truncate text-sm text-slate-700">{it.label}</p>
                    <p className={`text-xs font-medium ${it.overdue ? "text-red-600" : "text-amber-600"}`}>
                      {it.when}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
