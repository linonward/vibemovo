import { VideoGenerationError, type VideoJob, type VideoProvider, type VideoResult } from "./types";

// fal image-to-video with Kling 2.6 Pro, through fal's queue API. Kling has
// one resolution (1080p), so the job's resolution is ignored. The start image
// goes as a data URI, so fal never needs to reach the bucket.
// https://fal.ai/docs/model-apis/model-endpoints/queue
// https://fal.ai/models/fal-ai/kling-video/v2.6/pro/image-to-video/api

const QUEUE_URL = "https://queue.fal.run";
const MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";
// Status and results live under the app ID, without the endpoint's sub-path.
const APP = MODEL.split("/").slice(0, 2).join("/");

export const falProvider: VideoProvider = {
  id: "fal",
  configured: () => Boolean(process.env.FAL_KEY),
  submit,
  result,
};

function headers() {
  const key = process.env.FAL_KEY;
  if (!key) throw new VideoGenerationError("FAL_KEY is not set");
  return { "content-type": "application/json", authorization: `Key ${key}` };
}

async function call(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: headers(),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { response, body };
}

async function submit(job: VideoJob): Promise<string> {
  const { response, body } = await call(`${QUEUE_URL}/${MODEL}`, {
    method: "POST",
    body: JSON.stringify({
      prompt: job.prompt,
      start_image_url: `data:${job.image.mime};base64,${Buffer.from(job.image.bytes).toString("base64")}`,
      duration: String(job.duration),
      // Audio doubles the price.
      generate_audio: false,
    }),
  });
  if (!response.ok || typeof body.request_id !== "string") {
    throw new VideoGenerationError(`fal ${response.status}: ${describe(body)}`, errorType(body));
  }
  return body.request_id;
}

async function result(requestId: string): Promise<VideoResult> {
  const base = `${QUEUE_URL}/${APP}/requests/${encodeURIComponent(requestId)}`;
  const status = await call(`${base}/status`);
  if (!status.response.ok) {
    throw new VideoGenerationError(`fal status ${status.response.status}: ${describe(status.body)}`);
  }
  if (status.body.status !== "COMPLETED") return { status: "pending" };

  const result = await call(base);
  const url = (result.body.video as { url?: unknown } | undefined)?.url;
  if (result.response.ok && typeof url === "string") return { status: "succeeded", url };
  // 5xx from the result endpoint can be fal itself, not the generation.
  if (!status.body.error && result.response.status >= 500) {
    throw new VideoGenerationError(`fal result ${result.response.status}: ${describe(result.body)}`);
  }
  return {
    status: "failed",
    code: errorType(result.body) ?? errorType(status.body),
    error: `fal ${result.response.status}: ${describe(result.body)} (request ${requestId})`,
  };
}

// Model errors carry a detail array; request errors a string and error_type.
function errorType(body: Record<string, unknown>): string | undefined {
  if (Array.isArray(body.detail)) {
    const type = (body.detail[0] as { type?: unknown } | undefined)?.type;
    if (typeof type === "string") return type;
  }
  return typeof body.error_type === "string" ? body.error_type : undefined;
}

function describe(body: Record<string, unknown>): string {
  if (Array.isArray(body.detail)) {
    return body.detail.map((d: { msg?: unknown }) => String(d?.msg ?? "")).join("; ");
  }
  return String(body.detail ?? body.error ?? "no detail");
}
