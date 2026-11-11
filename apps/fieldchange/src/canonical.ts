/** Canonical SEO routing; never redirect Stripe POST/webhook requests. */
export function canonicalRedirect(method: string, host: string | null, requestUrl: string): string | null {
  if (method !== "GET" && method !== "HEAD") return null;
  const hostname = (host || "").trim().toLowerCase().replace(/:443$/, "");
  if (hostname !== "www.buildworkflow.ca") return null;
  try {
    const url = new URL(requestUrl);
    return "https://buildworkflow.ca" + url.pathname + url.search;
  } catch {
    return null;
  }
}
