"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "../components/icons";

export interface SettingsTab {
  id: string;
  label: string;
  icon: IconName;
  hint?: string;
  content: React.ReactNode;
}

const STORAGE_KEY = "drr_settings_tab";

/**
 * Abas das Configurações. O conteúdo chega pronto do Server Component — só a
 * troca de aba é client-side, então cada seção continua sendo renderizada no
 * servidor com os dados do banco.
 */
export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  // Recupera a última aba aberta (localStorage e âncora da URL).
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    const stored = localStorage.getItem(STORAGE_KEY);
    const wanted = tabs.find((t) => t.id === fromHash)?.id || (stored && tabs.find((t) => t.id === stored)?.id);
    if (wanted) setActive(wanted);
  }, [tabs]);

  const select = (id: string) => {
    setActive(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      history.replaceState(null, "", `#${id}`);
    } catch {
      // hash/localStorage indisponível: a aba ainda troca normalmente
    }
  };

  const current = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Seções das configurações"
        className="mb-5 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-brand-600 text-on-accent shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {current && (
        <section role="tabpanel" aria-label={current.label} className="animate-fade-in">
          {current.hint && <p className="mb-4 text-sm text-slate-600">{current.hint}</p>}
          {current.content}
        </section>
      )}
    </div>
  );
}
