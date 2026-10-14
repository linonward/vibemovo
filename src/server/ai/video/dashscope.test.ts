import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { dashscopeVideoProvider, submitReferenceVideo } from "./dashscope";
import { type ReferenceVideoJob, VideoGenerationError, type VideoJob } from "./types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("DASHSCOPE_API_KEY", "sk-test");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const job: VideoJob = {
  prompt: "The fox runs",
  duration: 10,
  resolution: "720p",
  image: { bytes: new Uint8Array([1, 2, 3]), mime: "image/png", url: "https://storage.test/in.png" },
  idempotencyKey: "video:1",
};

const task = (output: object) => json({ request_id: "req-1", output: { task_id: "task-1", ...output } });

test("creates an async wan2.7 first-frame task from a signed URL", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  expect(await dashscopeVideoProvider.submit(job)).toBe("task-1");

  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
  );
  const headers = new Headers(init?.headers);
  expect(headers.get("authorization")).toBe("Bearer sk-test");
  expect(headers.get("x-dashscope-async")).toBe("enable");
  expect(JSON.parse(init?.body as string)).toEqual({
    model: "wan2.7-i2v-2026-04-25",
    input: {
      prompt: "The fox runs",
      media: [{ type: "first_frame", url: job.image.url }],
    },
    parameters: { resolution: "720P", duration: 10, prompt_extend: true, watermark: false },
  });
});

test("uses the configured base URL and model", async () => {
  vi.stubEnv("DASHSCOPE_BASE_URL", "https://ws-1.cn-beijing.maas.aliyuncs.com/");
  vi.stubEnv("DASHSCOPE_VIDEO_MODEL", "wan2.7-i2v");
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" })).mockResolvedValueOnce(
    task({ task_status: "RUNNING" }),
  );

  await dashscopeVideoProvider.submit(job);
  await dashscopeVideoProvider.result("task-1");

  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://ws-1.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).model).toBe("wan2.7-i2v");
  expect(fetchMock.mock.calls[1][0]).toBe("https://ws-1.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1");
});

test("reports Bailian's error code when the task is rejected", async () => {
  fetchMock.mockResolvedValueOnce(
    json({ request_id: "req-2", code: "DataInspectionFailed", message: "Input data may contain inappropriate content." }, 400),
  );

  const error = await dashscopeVideoProvider.submit(job).catch((e) => e);

  expect(error).toBeInstanceOf(VideoGenerationError);
  expect(error.code).toBe("DataInspectionFailed");
});

test.each(["PENDING", "RUNNING"])("is pending while %s", async (status) => {
  fetchMock.mockResolvedValueOnce(task({ task_status: status }));

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({ status: "pending" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://dashscope.aliyuncs.com/api/v1/tasks/task-1");
});

test("returns the video URL once succeeded", async () => {
  fetchMock.mockResolvedValueOnce(
    task({ task_status: "SUCCEEDED", video_url: "https://dashscope-result.test/out.mp4" }),
  );

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({
    status: "succeeded",
    url: "https://dashscope-result.test/out.mp4",
  });
});

test("reports a failed task with its code", async () => {
  fetchMock.mockResolvedValueOnce(
    task({ task_status: "FAILED", code: "DataInspectionFailed", message: "Output data may contain inappropriate content." }),
  );

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({
    status: "failed",
    code: "DataInspectionFailed",
    error: expect.stringContaining("inappropriate content"),
  });
});

test.each(["CANCELED", "UNKNOWN"])("treats %s as failed", async (status) => {
  fetchMock.mockResolvedValueOnce(task({ task_status: status }));

  expect(await dashscopeVideoProvider.result("task-1")).toMatchObject({ status: "failed" });
});

test("throws when Bailian can't be reached, so the caller retries later", async () => {
  fetchMock.mockResolvedValueOnce(json({ code: "InternalError", message: "busy" }, 500));

  await expect(dashscopeVideoProvider.result("task-1")).rejects.toThrow(VideoGenerationError);
});

const reference: ReferenceVideoJob = {
  prompt: "图1 raps, then 图2 raps",
  images: [
    { bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg", url: "https://storage.test/left.jpg?signed" },
    { bytes: new Uint8Array([4, 5, 6]), mime: "image/png", url: "https://storage.test/right.png?signed" },
  ],
  duration: 15,
  resolution: "720p",
  ratio: "16:9",
};

test("creates a wan3.0 reference-to-video task with audio, the images in order", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  expect(await submitReferenceVideo(reference)).toBe("task-1");

  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
  );
  expect(new Headers(init?.headers).get("x-dashscope-async")).toBe("enable");
  expect(JSON.parse(init?.body as string)).toEqual({
    model: "wan3.0-video",
    input: {
      prompt: "图1 raps, then 图2 raps",
      media: [
        { type: "reference_image", url: reference.images[0].url },
        { type: "reference_image", url: reference.images[1].url },
      ],
    },
    parameters: {
      resolution: "720P",
      ratio: "16:9",
      duration: 15,
      audio: true,
      prompt_extend: false,
      watermark: false,
    },
  });
});

test("reports Bailian's error code when a reference task is rejected", async () => {
  fetchMock.mockResolvedValueOnce(json({ request_id: "req-3", code: "IPInfringementSuspect", message: "no" }, 400));

  const error = await submitReferenceVideo(reference).catch((e) => e);

  expect(error).toBeInstanceOf(VideoGenerationError);
  expect(error.code).toBe("IPInfringementSuspect");
});
