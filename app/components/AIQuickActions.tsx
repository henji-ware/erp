"use client";

import { Icon } from "./icons";

// Os gatilhos do banner do dashboard. Vivem num client component porque a
// página é um Server Component: passar onClick direto de lá quebra o render.
export default function AIQuickActions() {
  const open = (event: "open-command-palette" | "open-drr-copilot", prompt?: string) => {
    window.dispatchEvent(new CustomEvent(event, prompt ? { detail: { prompt } } : undefined));
  };

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => open("open-command-palette")}
        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors flex items-center gap-2"
      >
        <Icon name="search" size={14} />
        <span>Buscar no ERP</span>
        <kbd className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-[10px]">Ctrl K</kbd>
      </button>

      <button
        type="button"
        onClick={() =>
          open(
            "open-drr-copilot",
            "Faça um resumo executivo da situação da DRR hoje: pipeline em aberto, contas vencidas e inspeções da semana."
          )
        }
        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white border border-indigo-400/40 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-900/40"
      >
        <Icon name="ai" size={14} />
        <span>Resumo do dia com IA</span>
      </button>
    </div>
  );
}
