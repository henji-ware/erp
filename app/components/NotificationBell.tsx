"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

export type BellItem = {
  section: string;
  href: string;
  label: string;
  when: string; // texto pronto ("vence hoje", "faltam 2 dias"…)
  overdue: boolean;
};

// Sino de avisos: mesmos prazos do e-mail diário, dentro do sistema.
// O painel é renderizado em portal (fora da sidebar) porque o container da
// aplicação tem overflow hidden e cortaria o dropdown.
export default function NotificationBell({ items }: { items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const PANEL_W = 320;
  const MARGIN = 8;

  // Calcula a posição do painel a partir do botão, mantendo-o na tela.
  function place() {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const maxH = Math.min(380, window.innerHeight - 2 * MARGIN);
    // Abre para cima quando não há espaço abaixo (caso do rodapé da sidebar).
    const spaceBelow = window.innerHeight - b.bottom;
    const top = spaceBelow > maxH + MARGIN ? b.bottom + MARGIN : Math.max(MARGIN, b.top - maxH - MARGIN);
    const left = Math.min(
      Math.max(MARGIN, b.left + b.width / 2 - PANEL_W / 2),
      window.innerWidth - PANEL_W - MARGIN,
    );
    setPos({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onReflow = () => place();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const overdue = items.filter((i) => i.overdue).length;

  const panel = (
    <div
      ref={panelRef}
      style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, width: PANEL_W }}
      className="z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-800">
          Prazos {items.length > 0 && <span className="text-slate-400">({items.length})</span>}
        </p>
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          Nada vencendo nos próximos dias. 🎉
        </p>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto">
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
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Avisos"
        title="Avisos de prazo"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800"
      >
        <Icon name="bell" size={18} />
        {items.length > 0 && (
          <span
            className={`absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              overdue > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}
