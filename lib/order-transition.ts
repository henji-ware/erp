const ACTIVE_STATUSES = new Set(["CONFIRMED", "INVOICED"]);

export type OrderEffect = "APPLY" | "REVERSE" | "NONE";

export function orderTransitionEffect(from: string, to: string): OrderEffect {
  const wasActive = ACTIVE_STATUSES.has(from);
  const willBeActive = ACTIVE_STATUSES.has(to);
  if (!wasActive && willBeActive) return "APPLY";
  if (wasActive && !willBeActive) return "REVERSE";
  return "NONE";
}

