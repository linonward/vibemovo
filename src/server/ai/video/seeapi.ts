import { VideoGenerationError, type VideoJob, type VideoProvider, type VideoResult } from "./types";

// SeeAPI image-to-video with Seedance 2.0. SeeAPI only takes the start image
// as a URL, so it gets a signed URL to the bucket, which must be reachable
// from the internet (not a local MinIO).
// https://www.seeapi.com/docs/seedance-2/image-to-video/
// https://www.seeapi.com/docs/get-task-detail/

const BASE_URL = "https://api.seeapi.com/v1";
const MODEL = "seedance-2";
const TERMINAL_FAILURES = new Set(["failed", "canceled", "refunded", "expired"]);

export const seeapiProvider: VideoProvider = {
  id: "seeapi",
  configured: () => Boolean(process.env.SEEAPI_API_KEY),
  submit,
  result,
};

type Generation = {
  id?: string;
  status?: string;
  result?: { assets?: { type?: string; url?: string }[] };
  error?: unknown;
};

async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const key = process.env.SEEAPI_API_KEY;
  if (!key) throw new VideoGenerationError("SEEAPI_API_KEY is not set");
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as { generation?: Generation };
  return { response, body };
}

async function submit(job: VideoJob): Promise<string> {
  const { response, body } = await call("/generations", {
    method: "POST",
    // A retry with the same key returns the same task instead of a new one.
    headers: { "idempotency-key": job.idempotencyKey },
    body: JSON.stringify({
      model: MODEL,
      endpoint: "image-to-video",
      input: {
        prompt: job.prompt,
        first_frame_image: job.image.url,
        // Follows the start image.
        aspect_ratio: "adaptive",
        duration_seconds: job.duration,
        resolution: job.resolution,
        generate_audio: false,
      },
    }),
  });
  const id = body.generation?.id;
  if (!response.ok || !id) {
    throw new VideoGenerationError(`SeeAPI ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return id;
}

async function result(taskId: string): Promise<VideoResult> {
  const { response, body } = await call(`/generations/${encodeURIComponent(taskId)}`);
  const generation = body.generation;
  if (!response.ok || !generation) {
    throw new VideoGenerationError(`SeeAPI task ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  const status = generation.status ?? "";
  if (status === "succeeded") {
    const url = generation.result?.assets?.find((asset) => asset.type === "video")?.url;
    if (url) return { status: "succeeded", url };
    return { status: "failed", error: `SeeAPI task ${taskId} succeeded without a video` };
  }
  if (TERMINAL_FAILURES.has(status)) {
    const detail = generation.error ? `: ${JSON.stringify(generation.error).slice(0, 500)}` : "";
    return { status: "failed", code: status, error: `SeeAPI task ${taskId} ${status}${detail}` };
  }
  return { status: "pending" };
}
