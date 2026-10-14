// IndexNow (indexnow.org) tells Bing, Yandex and the other participating
// search engines which URLs changed, so they crawl them without waiting.
// Google doesn't take part. The key proves the site owns the URLs: the
// engines fetch it from /indexnow.txt (src/app/indexnow.txt/route.ts).
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

// The protocol's cap per request.
const MAX_URLS = 10_000;

// Submits the URLs, all on one host, in batches. Stops at the first batch
// an engine refuses and returns its status; 200 and 202 both mean accepted.
// status is null when there was nothing to send.
export async function submitUrls(
  urls: string[],
  key = process.env.INDEXNOW_KEY,
): Promise<{ submitted: number; status: number | null }> {
  if (!key) throw new Error("INDEXNOW_KEY is not set");
  if (urls.length === 0) return { submitted: 0, status: null };
  const origin = new URL(urls[0]).origin;
  const host = new URL(origin).host;
  for (const url of urls) {
    if (new URL(url).origin !== origin) throw new Error(`${url} is not on ${host}`);
  }

  let submitted = 0;
  let status = 0;
  for (let start = 0; start < urls.length; start += MAX_URLS) {
    const urlList = urls.slice(start, start + MAX_URLS);
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation: `${origin}/indexnow.txt`, urlList }),
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    if (!response.ok) break;
    submitted += urlList.length;
  }
  return { submitted, status };
}
