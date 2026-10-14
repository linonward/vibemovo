import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { falProvider } from "./fal";
import { VideoGenerationError, type VideoJob } from "./types";

const job = (overrides: Partial<VideoJob> = {}): VideoJob => ({
  prompt: "The fox runs",
  duration: 5,
  resolution: "1080p",
  image: { bytes: new Uint8Array([1, 2, 3]), mime: "image/png", url: "https://storage.test/in.png" },
  idempotencyKey: "video:1",
  ...overrides,
});

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("FAL_KEY", "fal-test");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const QUEUE = "https://queue.fal.run/fal-ai/kling-video";

test("queues Kling image-to-video from a data URI, without audio", async () => {
  fetchMock.mockResolvedValueOnce(
    json({ request_id: "req-1", status_url: `${QUEUE}/requests/req-1/status`, queue_position: 0 }),
  );

  const id = await falProvider.submit(job({ duration: 10 }));

  expect(id).toBe("req-1");
  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://queue.fal.run/fal-ai/kling-video/v2.6/pro/image-to-video");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("authorization")).toBe("Key fal-test");
  expect(JSON.parse(init?.body as string)).toEqual({
    prompt: "The fox runs",
    start_image_url: "data:image/png;base64,AQID",
    duration: "10",
    generate_audio: false,
  });
});

test("reports a rejected submission", async () => {
  fetchMock.mockResolvedValueOnce(json({ detail: "Invalid key" }, 401));

  const error = await falProvider.submit(job()).catch((e) => e);

  expect(error).toBeInstanceOf(VideoGenerationError);
  expect(error.message).toContain("401");
});

test("is pending while the request is queued or running", async () => {
  fetchMock.mockResolvedValueOnce(json({ status: "IN_QUEUE", queue_position: 3 }));
  expect(await falProvider.result("req-1")).toEqual({ status: "pending" });
  expect(fetchMock.mock.calls[0][0]).toBe(`${QUEUE}/requests/req-1/status`);

  fetchMock.mockResolvedValueOnce(json({ status: "IN_PROGRESS" }));
  expect(await falProvider.result("req-1")).toEqual({ status: "pending" });
});

test("returns the video URL once completed", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ status: "COMPLETED", metrics: { inference_time: 90 } }))
    .mockResolvedValueOnce(
      json({ video: { url: "https://v3.fal.media/files/out.mp4", content_type: "video/mp4" } }),
    );

  expect(await falProvider.result("req-1")).toEqual({
    status: "succeeded",
    url: "https://v3.fal.media/files/out.mp4",
  });
  expect(fetchMock.mock.calls[1][0]).toBe(`${QUEUE}/requests/req-1`);
});

test("reports a failed generation with fal's error type", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ status: "COMPLETED", error: "Unprocessable", error_type: "x" }))
    .mockResolvedValueOnce(
      json(
        { detail: [{ loc: ["body"], msg: "Content blocked", type: "content_policy_violation" }] },
        422,
      ),
    );

  expect(await falProvider.result("req-1")).toEqual({
    status: "failed",
    code: "content_policy_violation",
    error: expect.stringContaining("Content blocked"),
  });
});

test("reports a request-level failure", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ status: "COMPLETED", error: "Timed out", error_type: "generation_timeout" }))
    .mockResolvedValueOnce(json({ detail: "Timed out", error_type: "generation_timeout" }, 504));

  expect(await falProvider.result("req-1")).toEqual({
    status: "failed",
    code: "generation_timeout",
    error: expect.stringContaining("Timed out"),
  });
});

test("throws when fal can't be reached, so the caller retries later", async () => {
  fetchMock.mockResolvedValueOnce(json({ detail: "Bad gateway" }, 502));

  await expect(falProvider.result("req-1")).rejects.toThrow(VideoGenerationError);
});
