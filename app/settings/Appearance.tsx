"use client";

import { useEffect, useState } from "react";
import {
  THEMES,
  MODES,
  THEME_COOKIE,
  MODE_COOKIE,
  SWATCH_NEUTRAL,
} from "@/lib/theme";
import { Icon, type IconName } from "../components/icons";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

const MODE_ICONS: Record<string, IconName> = {
  light: "sun",
  dark: "moon",
  system: "monitor",
};

export default function Appearance({
  currentTheme,
  currentMode,
}: {
  currentTheme: string;
  currentMode: string;
}) {
  const [theme, setTheme] = useState(currentTheme);
  const [mode, setMode] = useState(currentMode);
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const effectiveDark = mode === "dark" || (mode === "system" && prefersDark);
  const base = effectiveDark ? SWATCH_NEUTRAL.dark : SWATCH_NEUTRAL.light;

  function chooseTheme(id: string) {
    setTheme(id);
    setCookie(THEME_COOKIE, id);
    document.documentElement.setAttribute("data-theme", id);
  }
  function chooseMode(id: string) {
    setMode(id);
    setCookie(MODE_COOKIE, id);
    document.documentElement.setAttribute("data-mode", id);
  }

  return (
    <div className="space-y-6">
      {/* Seletor de modo */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Modo</p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => chooseMode(m.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon name={MODE_ICONS[m.id]} size={16} />
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          “Sistema” segue o claro/escuro do seu computador.
        </p>
      </div>

      {/* Grade de temas */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Cor de destaque</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {THEMES.map((t) => {
            const active = theme === t.id;
            const panel = `color-mix(in srgb, ${base.panel} 88%, ${t.tint})`;
            const barNeutral = `color-mix(in srgb, ${base.bar} 86%, ${t.tint})`;
            return (
              <button
                key={t.id}
                onClick={() => chooseTheme(t.id)}
                className={`group flex items-center gap-4 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                  active
                    ? "border-brand-500 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className="flex h-12 w-14 shrink-0 items-center justify-center gap-1 rounded-lg"
                  style={{ background: panel }}
                >
                  {[barNeutral, t.accentSoft, t.accent].map((c, i) => (
                    <span
                      key={i}
                      className="h-7 w-1.5 rounded-full transition-all group-hover:h-8"
                      style={{ background: c }}
                    />
                  ))}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{t.name}</p>
                    {active && (
                      <span className="text-brand-600">
                        <Icon name="check" size={16} />
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
