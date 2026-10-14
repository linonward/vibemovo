import { dashscopeBaseUrl, dashscopeConfigured } from "../dashscope";
import {
  type ReferenceVideoJob,
  VideoGenerationError,
  type VideoJob,
  type VideoProvider,
  type VideoResult,
} from "./types";

// Alibaba Cloud Model Studio (Bailian / DashScope) image-to-video with Wan
// 2.7, as an async task. The start image goes as a data URI, so Bailian never
// needs to reach the bucket. Wan 2.7 adds its own audio and has no silent
// option. Bailian keeps the result for 24 hours, so callers copy it.
// https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference
// Reference-to-video uses Wan 3.0, polled the same way.
// https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference

const DEFAULT_MODEL = "wan2.7-i2v-2026-04-25";
const REFERENCE_MODEL = "wan3.0-video";
const CREATE_PATH = "/api/v1/services/aigc/video-generation/video-synthesis";
const FAILED = new Set(["FAILED", "CANCELED", "UNKNOWN"]);

export const dashscopeVideoProvider: VideoProvider = {
  id: "dashscope",
  configured: dashscopeConfigured,
  submit,
  result,
};

type Response = {
  code?: string;
  message?: string;
  request_id?: string;
  output?: { task_id?: string; task_status?: string; video_url?: string; code?: string; message?: string };
};

async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new VideoGenerationError("DASHSCOPE_API_KEY is not set");
  const response = await fetch(`${dashscopeBaseUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as Response;
  return { response, body };
}

async function submit(job: VideoJob): Promise<string> {
  return createTask({
    model: process.env.DASHSCOPE_VIDEO_MODEL || DEFAULT_MODEL,
    input: { prompt: job.prompt, media: [{ type: "first_frame", url: dataUri(job.image) }] },
    // Bailian spells resolutions "720P".
    parameters: {
      resolution: job.resolution.toUpperCase(),
      duration: job.duration,
      prompt_extend: true,
      watermark: false,
    },
  });
}

// Queues a Wan 3.0 video from reference images, with sound. The prompt is
// sent as written: rewriting it would lose the quoted lines.
export function submitReferenceVideo(job: ReferenceVideoJob): Promise<string> {
  return createTask({
    model: REFERENCE_MODEL,
    input: {
      prompt: job.prompt,
      media: job.images.map((image) => ({ type: "reference_image", url: dataUri(image) })),
    },
    parameters: {
      resolution: job.resolution.toUpperCase(),
      ratio: job.ratio,
      duration: job.duration,
      audio: true,
      prompt_extend: false,
      watermark: false,
    },
  });
}

function dataUri(image: { bytes: Uint8Array; mime: string }) {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`;
}

async function createTask(body: object): Promise<string> {
  const { response, body: reply } = await call(CREATE_PATH, {
    method: "POST",
    // The video API is async only.
    headers: { "x-dashscope-async": "enable" },
    body: JSON.stringify(body),
  });
  const taskId = reply.output?.task_id;
  if (!response.ok || reply.code || !taskId) {
    throw new VideoGenerationError(
      `Bailian ${response.status} ${reply.code ?? ""}: ${reply.message ?? ""} (request ${reply.request_id ?? "?"})`,
      reply.code,
    );
  }
  return taskId;
}

async function result(taskId: string): Promise<VideoResult> {
  const { response, body } = await call(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  const output = body.output;
  if (!response.ok || !output?.task_status) {
    throw new VideoGenerationError(
      `Bailian task ${response.status} ${body.code ?? ""}: ${body.message ?? ""} (request ${body.request_id ?? "?"})`,
      body.code,
    );
  }
  if (output.task_status === "SUCCEEDED" && output.video_url) {
    return { status: "succeeded", url: output.video_url };
  }
  // UNKNOWN: the task is gone, as after 24 hours.
  if (output.task_status === "SUCCEEDED" || FAILED.has(output.task_status)) {
    return {
      status: "failed",
      code: output.code ?? output.task_status,
      error: `Bailian task ${taskId} ${output.task_status} ${output.code ?? ""}: ${output.message ?? ""}`,
    };
  }
  return { status: "pending" };
}
