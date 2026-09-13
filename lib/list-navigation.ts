/** Keep list filters, but never retain a stale page when returning to page 1. */
export function listPageHref(basePath: string, page: number, params: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  return query.size ? `${basePath}?${query}` : basePath;
}
