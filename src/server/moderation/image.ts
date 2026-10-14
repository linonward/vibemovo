import { ContentBlockedError } from "./index";

// SeeAPI's NSFW filter: an async task that downloads the image from a URL,
// so the image must be in a bucket reachable from the internet.
// https://www.seeapi.com/docs/nsfw-filter/image-moderation
const BASE_URL = "https://api.seeapi.com/v1";

// The check couldn't give a verdict. Uploads are refused until it can.
export class ModerationUnavailableError extends Error {}

type Inference = {
  id?: string;
  status?: string;
  result?: { data?: { flagged?: unknown; categories?: { nsfw?: string[]; special_care?: string[] } } } | null;
  error?: unknown;
};

export function imageModerationEnabled(): boolean {
  return process.env.IMAGE_MODERATION === "seeapi";
}

async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<Inference> {
  const key = process.env.SEEAPI_API_KEY;
  if (!key) throw new ModerationUnavailableError("SEEAPI_API_KEY is not set");
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ModerationUnavailableError("SeeAPI moderation did not answer", { cause: error });
  }
  const body = (await response.json().catch(() => ({}))) as Inference;
  if (!response.ok) {
    throw new ModerationUnavailableError(`SeeAPI moderation answered ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

// Throws ContentBlockedError if the image is flagged, and
// ModerationUnavailableError if no verdict arrives in time. `key` is stable
// per upload, so a retried request doesn't start a second check.
export async function checkImage(
  url: string,
  key: string,
  { pollMs = 1000, timeoutMs = 30_000 }: { pollMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let task = await call("/inferences", {
    method: "POST",
    headers: { "idempotency-key": `moderation:${key}` },
    body: JSON.stringify({
      model: "nsfw-filter",
      endpoint: "image-moderation",
      provider: "seeapi",
      input: { image_url: url },
    }),
  });
  if (!task.id) throw new ModerationUnavailableError("SeeAPI moderation returned no task ID");

  while (task.status === "queued" || task.status === "processing") {
    if (Date.now() > deadline) throw new ModerationUnavailableError("SeeAPI moderation timed out");
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    task = await call(`/inferences/${encodeURIComponent(task.id ?? "")}`);
  }

  const data = task.result?.data;
  if (task.status !== "succeeded" || task.error || typeof data?.flagged !== "boolean") {
    throw new ModerationUnavailableError(`SeeAPI moderation gave no verdict: ${JSON.stringify(task)}`);
  }
  if (data.flagged) {
    const labels = [...(data.categories?.nsfw ?? []), ...(data.categories?.special_care ?? [])];
    throw new ContentBlockedError(`The image was flagged: ${labels.join(", ") || "no labels"}`);
  }
}
