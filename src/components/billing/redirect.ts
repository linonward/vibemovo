import type { ApiBody, ApiErrorCode, RedirectResponse } from "@/lib/api";

// Posts to a payment endpoint that answers { url } and sends the browser
// there. Returns null after redirecting. Otherwise returns the error code,
// or undefined if none came back (e.g. the network failed).
export async function redirectFrom(endpoint: string, body: object): Promise<ApiErrorCode | undefined | null> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const { url, error }: ApiBody<RedirectResponse> = response ? await response.json().catch(() => ({})) : {};
  if (!response?.ok || !url) return error;
  window.location.assign(url);
  return null;
}
