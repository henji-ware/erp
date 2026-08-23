// Rótulos e cores do razão de estoque.
//
// Vive fora de lib/format.ts porque depende do enum StockReason gerado pelo
// Prisma — e format.ts é importado por praticamente toda tela.

import type { StockReason } from "@prisma/client";

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  ORDER_CONFIRM: "Venda",
  ORDER_REVERSE: "Cancelamento",
  PURCHASE: "Compra",
  ADJUSTMENT: "Acerto",
};

/** Classes do <Badge>; ver .badge-tone em globals.css. */
export const STOCK_REASON_TONES: Record<StockReason, string> = {
  ORDER_CONFIRM: "badge-tone badge-info",
  ORDER_REVERSE: "badge-tone badge-warn",
  PURCHASE: "badge-tone badge-success",
  ADJUSTMENT: "badge-tone badge-neutral",
};
