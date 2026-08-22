"use client";

import { useRef, useState, useTransition } from "react";
import { updateLeadStage } from "./actions";

/**
 * Kanban do funil com arrastar e soltar.
 *
 * O conteúdo dos cartões continua sendo renderizado no servidor (com os
 * formulários das server actions): estes componentes só embrulham o que já
 * existe, adicionando a alça de arrasto e a área de soltura. Assim nada do
 * cartão precisou virar client component.
 *
 * Arrastar é gesto de mouse — não funciona no toque nem no teclado. Por isso
 * o <StageSelect> continua dentro de cada cartão: ele é o caminho acessível
 * para a mesma ação, não um resto de código.
 */

// Tipo próprio no dataTransfer: durante o `dragover` o navegador não deixa
// LER os dados (só a lista de tipos), então é por ele que a coluna sabe que
// o que está passando por cima é um lead, e não um arquivo ou uma seleção.
const LEAD_MIME = "application/x-drr-lead";

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.3" />
      <circle cx="10" cy="4" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="10" cy="12" r="1.3" />
    </svg>
  );
}

export function KanbanCard({
  id,
  stage,
  children,
}: {
  id: number;
  stage: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      ref={ref}
      className={`group relative transition-opacity ${dragging ? "opacity-40" : ""}`}
    >
      {/* Só a alça é arrastável. Com o cartão inteiro `draggable`, o clique no
          select de etapa e a seleção de texto passam a brigar com o arrasto. */}
      <div
        draggable
        role="button"
        tabIndex={-1}
        aria-label="Arrastar para outra etapa"
        title="Arraste para mover de etapa"
        onDragStart={(e) => {
          e.dataTransfer.setData(LEAD_MIME, JSON.stringify({ id, stage }));
          e.dataTransfer.effectAllowed = "move";
          // Sem isto o "fantasma" arrastado seria só a alça de 20px.
          if (ref.current) e.dataTransfer.setDragImage(ref.current, 24, 18);
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        className="absolute right-1.5 top-1.5 z-10 cursor-grab rounded-md p-1 text-slate-300
                   opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-500
                   focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripIcon />
      </div>
      {children}
    </div>
  );
}

export function KanbanColumn({
  stage,
  children,
}: {
  stage: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  // `dragEnter`/`dragLeave` disparam também ao passar entre os filhos da
  // coluna. O contador evita que o realce pisque a cada cartão atravessado.
  const depth = useRef(0);

  const carriesLead = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(LEAD_MIME);

  return (
    <div
      onDragEnter={(e) => {
        if (!carriesLead(e)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!carriesLead(e)) return;
        e.preventDefault(); // sem isto o navegador recusa a soltura
        e.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(e) => {
        if (!carriesLead(e)) return;
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(e) => {
        depth.current = 0;
        setOver(false);
        if (!carriesLead(e)) return;
        e.preventDefault();

        const raw = e.dataTransfer.getData(LEAD_MIME);
        if (!raw) return;
        let payload: { id?: number; stage?: string };
        try {
          payload = JSON.parse(raw);
        } catch {
          return;
        }
        // Soltar na própria coluna não é mudança: evita gravação e auditoria
        // de um "Etapa → Novo" que não mudou nada.
        if (!payload.id || payload.stage === stage) return;

        const data = new FormData();
        data.set("id", String(payload.id));
        data.set("stage", stage);
        startTransition(() => {
          void updateLeadStage(data);
        });
      }}
      className={`rounded-xl bg-slate-100 p-3 transition-all duration-150 ${
        over ? "accent-selected accent-ring" : "border border-transparent"
      } ${pending ? "opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}
