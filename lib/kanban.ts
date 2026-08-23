// Geometria do arrasto do kanban — pura, sem DOM, para ter teste.

/** Distância mínima antes de virar arrasto, para um toque não virar drag. */
export const DRAG_THRESHOLD_PX = 8;

/**
 * Quanto rolar quando o dedo (ou o cursor) se aproxima da borda da área
 * rolável durante o arrasto.
 *
 * No celular isto não é enfeite: as etapas ficam empilhadas, e sem rolagem
 * automática não há como levar um cartão de "Novo contato" até "Vendido" —
 * o dedo já está pressionado, então o gesto de rolar não está disponível.
 *
 * A velocidade cresce conforme se entra na faixa: encostar de leve rola
 * devagar, ir até a borda rola rápido.
 */
export function edgeScrollDelta(
  y: number,
  top: number,
  bottom: number,
  zone = 72,
  maxSpeed = 18,
): number {
  // Área menor que duas faixas: rolar por borda só atrapalharia.
  if (bottom - top < zone * 2) return 0;

  if (y < top + zone) {
    const ratio = Math.min(1, (top + zone - y) / zone);
    return -Math.ceil(ratio * maxSpeed);
  }
  if (y > bottom - zone) {
    const ratio = Math.min(1, (y - (bottom - zone)) / zone);
    return Math.ceil(ratio * maxSpeed);
  }
  return 0;
}

/** Passou do limiar para começar a arrastar? */
export function passedThreshold(
  dx: number,
  dy: number,
  threshold = DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Deslocamento visual do cartão que está sendo arrastado.
 *
 * O `scrollDelta` é o que a área rolou desde o início. Sem ele, quando a
 * rolagem automática entra, o cartão sobe junto com o conteúdo e "foge" do
 * dedo — some da tela enquanto o dedo continua parado.
 */
export function dragOffset(
  current: { x: number; y: number },
  start: { x: number; y: number },
  scrollDelta = 0,
): { dx: number; dy: number } {
  return {
    dx: current.x - start.x,
    dy: current.y - start.y + scrollDelta,
  };
}
