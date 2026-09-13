/** Device OAuth has no redirect callback. Require a browser same-origin request. */
export function isDeviceRequestOriginAllowed(headers: Headers, requestUrl: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) return false;
    // Fetch Metadata is browser-controlled and survives reverse proxies.
    return site === "same-origin" || parsed.origin === new URL(requestUrl).origin;
  } catch { return false; }
}
