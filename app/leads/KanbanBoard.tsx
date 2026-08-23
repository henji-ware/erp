"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { updateLeadStage } from "./actions";
import { dragOffset, edgeScrollDelta, passedThreshold } from "@/lib/kanban";

/**
 * Kanban do funil, arrastável no mouse E no toque.
 *
 * A primeira versão usava a API de drag-and-drop do HTML5 (`draggable`,
 * `dragstart`, `drop`). Ela não existe em toque: no celular a alça aparecia
 * e não fazia absolutamente nada — pior que não ter alça, porque promete uma
 * interação que não acontece. Aqui o arrasto é feito com Pointer Events, que
 * são os mesmos para mouse, dedo e caneta.
 *
 * O que isso trouxe de brinde no celular:
 *   - o cartão real acompanha o dedo (nada de "fantasma" do navegador);
 *   - a lista rola sozinha ao chegar perto das bordas — sem isso não haveria
 *     como levar um cartão até uma etapa fora da tela, já que o dedo está
 *     ocupado segurando o cartão;
 *   - a alça é sempre visível onde não existe hover, e tem alvo de 44px.
 *
 * O conteúdo dos cartões continua vindo do servidor: estes componentes só
 * embrulham o markup existente. E o <StageSelect> segue dentro do cartão —
 * é o caminho de teclado, que arrasto nenhum substitui.
 */

type Dragging = { id: number; fromStage: string };

interface KanbanCtx {
  dragging: Dragging | null;
  overStage: string | null;
  savingId: number | null;
  begin: (d: Dragging) => void;
  hover: (stage: string | null) => void;
  drop: () => void;
  cancel: () => void;
}

const KanbanContext = createContext<KanbanCtx | null>(null);

function useKanban(): KanbanCtx {
  const ctx = useContext(KanbanContext);
  if (!ctx) throw new Error("KanbanCard/KanbanColumn precisam ficar dentro de <KanbanBoard>");
  return ctx;
}

/** Atributo que marca a área de soltura — lido por elementFromPoint. */
const STAGE_ATTR = "data-kanban-stage";

/* ------------------------------------------------------------------ */
/* Board (estado compartilhado + grade)                                */
/* ------------------------------------------------------------------ */

export function KanbanBoard({ children }: { children: React.ReactNode }) {
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const begin = useCallback((d: Dragging) => {
    setDragging(d);
    setOverStage(null);
  }, []);

  const hover = useCallback((stage: string | null) => setOverStage(stage), []);

  const cancel = useCallback(() => {
    setDragging(null);
    setOverStage(null);
  }, []);

  const drop = useCallback(() => {
    const current = dragging;
    const target = overStage;
    setDragging(null);
    setOverStage(null);

    // Soltar fora de uma coluna, ou na própria etapa, não é mudança: evita
    // gravação e uma linha de auditoria "Etapa → Novo" que não mudou nada.
    if (!current || !target || target === current.fromStage) return;

    const data = new FormData();
    data.set("id", String(current.id));
    data.set("stage", target);

    setSavingId(current.id);
    startTransition(async () => {
      try {
        await updateLeadStage(data);
      } catch {
        // A action revalida a página; se falhou, o cartão continua onde está.
      } finally {
        setSavingId(null);
      }
    });
  }, [dragging, overStage]);

  // Enquanto arrasta, o cursor é "agarrando" na página inteira e a seleção
  // de texto fica desligada — senão arrastar por cima de um nome de cliente
  // começa a selecionar o texto no meio do gesto.
  useEffect(() => {
    if (!dragging) return;
    const style = document.body.style;
    const before = { cursor: style.cursor, userSelect: style.userSelect };
    style.cursor = "grabbing";
    style.userSelect = "none";
    return () => {
      style.cursor = before.cursor;
      style.userSelect = before.userSelect;
    };
  }, [dragging]);

  return (
    <KanbanContext.Provider
      value={{ dragging, overStage, savingId, begin, hover, drop, cancel }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {children}
      </div>
    </KanbanContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Cartão                                                              */
/* ------------------------------------------------------------------ */

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

/** Ancestral que realmente rola — no ERP é o <main>, não a janela. */
function scrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
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
  const { dragging, begin, hover, drop, cancel, savingId } = useKanban();
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);

  // Tudo o que muda a cada pointermove fica em ref: colocar em estado
  // re-renderizaria a árvore inteira do quadro a cada pixel.
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    scroller: HTMLElement | null;
    scrollStart: number;
    active: boolean;
    raf: number | null;
  } | null>(null);

  const isDragging = dragging?.id === id;
  const isSaving = savingId === id;

  const stopAutoScroll = useCallback(() => {
    const g = gesture.current;
    if (g?.raf !== null && g?.raf !== undefined) {
      cancelAnimationFrame(g.raf);
      g.raf = null;
    }
  }, []);

  /** Reposiciona o cartão e descobre sobre qual coluna o ponteiro está. */
  const track = useCallback(() => {
    const g = gesture.current;
    if (!g || !g.active) return;

    const scrolled = g.scroller ? g.scroller.scrollTop - g.scrollStart : 0;
    setOffset(
      dragOffset({ x: g.lastX, y: g.lastY }, { x: g.startX, y: g.startY }, scrolled),
    );

    // O cartão arrastado está com pointer-events desligado, então
    // elementFromPoint enxerga a coluna por baixo dele.
    const under = document.elementFromPoint(g.lastX, g.lastY);
    const column = under?.closest(`[${STAGE_ATTR}]`);
    hover(column?.getAttribute(STAGE_ATTR) ?? null);
  }, [hover]);

  /** Laço de rolagem automática enquanto o ponteiro fica perto das bordas. */
  const autoScroll = useCallback(() => {
    const g = gesture.current;
    if (!g || !g.active) return;

    const scroller = g.scroller;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const delta = edgeScrollDelta(g.lastY, rect.top, rect.bottom);
      if (delta !== 0) scroller.scrollTop += delta;
    }
    track();
    g.raf = requestAnimationFrame(autoScroll);
  }, [track]);

  const endGesture = useCallback(
    (commit: boolean) => {
      stopAutoScroll();
      const g = gesture.current;
      gesture.current = null;
      setOffset(null);
      if (!g?.active) {
        // Nunca virou arrasto (foi um toque): não mexe no estado do quadro.
        return;
      }
      if (commit) drop();
      else cancel();
    },
    [drop, cancel, stopAutoScroll],
  );

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    // Só botão principal / toque. Botão do meio e direito ficam de fora.
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const scroller = scrollableAncestor(cardRef.current);
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      scroller,
      scrollStart: scroller?.scrollTop ?? 0,
      active: false,
      raf: null,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;

    g.lastX = e.clientX;
    g.lastY = e.clientY;

    if (!g.active) {
      // Só vira arrasto depois de andar um pouco: no toque, um tap sempre
      // move alguns pixels, e sem o limiar todo toque na alça viraria drag.
      if (!passedThreshold(e.clientX - g.startX, e.clientY - g.startY)) return;
      g.active = true;
      begin({ id, fromStage: stage });
      g.raf = requestAnimationFrame(autoScroll);
    }
    track();
  }

  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    endGesture(true);
  }

  function onPointerCancel(e: React.PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    endGesture(false);
  }

  // Se o componente sair da tela no meio do gesto (revalidação do servidor
  // troca a lista), o laço de animação precisa parar junto.
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  return (
    <div
      ref={cardRef}
      style={
        offset
          ? {
              transform: `translate3d(${offset.dx}px, ${offset.dy}px, 0) scale(1.03)`,
              zIndex: 40,
              position: "relative",
              // Sem isto, o cartão fica embaixo do ponteiro e
              // elementFromPoint devolveria sempre ele mesmo.
              pointerEvents: "none",
              touchAction: "none",
            }
          : undefined
      }
      className={`group relative ${
        isDragging
          ? "kanban-dragging opacity-95 shadow-2xl"
          : "transition-transform duration-150"
      } ${isSaving ? "animate-pulse opacity-60" : ""}`}
    >
      {/* A alça é o único ponto de arrasto: com o cartão inteiro arrastável,
          o select de etapa e os botões não recebem mais o toque.

          `touch-action: none` é obrigatório aqui — sem ele o navegador do
          celular entende o gesto como rolagem, engole os pointermove e o
          arrasto nunca começa. */}
      <button
        type="button"
        aria-label="Arrastar para outra etapa"
        title="Arraste para mover de etapa"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className="kanban-grip absolute right-1 top-1 z-10 flex h-9 w-9 items-center justify-center
                   rounded-lg text-slate-300 transition-opacity
                   hover:bg-slate-100 hover:text-slate-500
                   focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2
                   md:h-7 md:w-7"
      >
        <GripIcon />
      </button>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coluna                                                              */
/* ------------------------------------------------------------------ */

export function KanbanColumn({
  stage,
  children,
}: {
  stage: string;
  children: React.ReactNode;
}) {
  const { dragging, overStage } = useKanban();
  const isTarget = overStage === stage;
  // Destaca a origem para deixar claro de onde o cartão saiu.
  const isSource = dragging?.fromStage === stage;

  return (
    <div
      {...{ [STAGE_ATTR]: stage }}
      className={`rounded-xl p-3 transition-colors duration-150 ${
        isTarget
          ? "accent-selected accent-ring"
          : dragging && !isSource
            ? "border border-dashed border-slate-300 bg-slate-100"
            : "border border-transparent bg-slate-100"
      }`}
    >
      {children}
    </div>
  );
}
