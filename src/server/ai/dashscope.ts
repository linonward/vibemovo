// Alibaba Cloud Model Studio (Bailian / DashScope) text-to-image, asynchronous
// API. Submitting returns a task ID; the task's result holds the image URL,
// which Bailian keeps for 24 hours.
// https://help.aliyun.com/en/model-studio/text-to-image-v2-api-reference

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com";
const DEFAULT_MODEL = "wan2.6-t2i";
const SUBMIT_PATH = "/api/v1/services/aigc/image-generation/generation";

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    // Bailian's error code, such as "DataInspectionFailed".
    readonly code?: string,
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export function dashscopeConfigured() {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

// The API host for the key's region. Image and video generation share it.
export function dashscopeBaseUrl() {
  return (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

type Response = {
  code?: string;
  message?: string;
  request_id?: string;
  output?: {
    task_id?: string;
    // PENDING, RUNNING, SUCCEEDED, FAILED, CANCELED or UNKNOWN (expired).
    task_status?: string;
    code?: string;
    message?: string;
    choices?: { message?: { content?: { image?: string }[] } }[];
  };
};

export type ImageResult =
  | { status: "pending" }
  | { status: "succeeded"; url: string }
  | { status: "failed"; code?: string; error: string };

async function call(path: string, init: RequestInit = {}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new ImageGenerationError("DASHSCOPE_API_KEY is not set");
  const response = await fetch(`${dashscopeBaseUrl()}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as Response;
  if (!response.ok || body.code) {
    throw new ImageGenerationError(
      `Bailian ${response.status} ${body.code ?? ""}: ${body.message ?? ""} (request ${body.request_id ?? "?"})`,
      body.code,
    );
  }
  return body;
}

// Queues one image and returns Bailian's task ID.
export async function submitImage(input: { prompt: string; size: string }): Promise<string> {
  const body = await call(SUBMIT_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dashscope-async": "enable" },
    body: JSON.stringify({
      model: process.env.DASHSCOPE_IMAGE_MODEL || DEFAULT_MODEL,
      input: { messages: [{ role: "user", content: [{ text: input.prompt }] }] },
      // n defaults to 4 and each image is billed.
      parameters: { n: 1, size: input.size, watermark: false, prompt_extend: true },
    }),
  });
  const taskId = body.output?.task_id;
  if (!taskId) throw new ImageGenerationError(`Bailian returned no task (request ${body.request_id ?? "?"})`);
  return taskId;
}

// Checks a queued image. Throws if Bailian can't answer, so the caller can
// retry later.
export async function imageResult(taskId: string): Promise<ImageResult> {
  const body = await call(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  const output = body.output ?? {};
  const status = output.task_status;
  if (status === "PENDING" || status === "RUNNING") return { status: "pending" };
  const url = output.choices?.[0]?.message?.content?.find((part) => part.image)?.image;
  if (status === "SUCCEEDED" && url) return { status: "succeeded", url };
  return {
    status: "failed",
    code: output.code,
    error: `Bailian task ${status ?? "?"} ${output.code ?? ""}: ${output.message ?? "no image"} (task ${taskId})`,
  };
}
