import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { seeapiProvider } from "./seeapi";
import { VideoGenerationError, type VideoJob } from "./types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("SEEAPI_API_KEY", "see-test");
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
  image: { bytes: new Uint8Array([1]), mime: "image/png", url: "https://storage.test/in.png?signed" },
  idempotencyKey: "video:1",
};

const generation = (fields: object) => json({ generation: { id: "task_1", ...fields } });

test("creates a Seedance 2.0 image-to-video task from the signed image URL", async () => {
  fetchMock.mockResolvedValueOnce(
    json({ generation: { id: "task_1", status: "processing" }, idempotent: false }, 202),
  );

  expect(await seeapiProvider.submit(job)).toBe("task_1");

  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://api.seeapi.com/v1/generations");
  expect(init?.method).toBe("POST");
  const headers = new Headers(init?.headers);
  expect(headers.get("authorization")).toBe("Bearer see-test");
  expect(headers.get("idempotency-key")).toBe("video:1");
  expect(JSON.parse(init?.body as string)).toEqual({
    model: "seedance-2",
    endpoint: "image-to-video",
    input: {
      prompt: "The fox runs",
      first_frame_image: "https://storage.test/in.png?signed",
      aspect_ratio: "adaptive",
      duration_seconds: 10,
      resolution: "720p",
      generate_audio: false,
    },
  });
});

test("reports a rejected task", async () => {
  fetchMock.mockResolvedValueOnce(json({ error: { message: "Insufficient credits" } }, 402));

  const error = await seeapiProvider.submit(job).catch((e) => e);

  expect(error).toBeInstanceOf(VideoGenerationError);
  expect(error.message).toContain("402");
});

test("is pending while the task is processing", async () => {
  fetchMock.mockResolvedValueOnce(generation({ status: "processing" }));

  expect(await seeapiProvider.result("task_1")).toEqual({ status: "pending" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.seeapi.com/v1/generations/task_1");
});

test("returns the video asset once succeeded", async () => {
  fetchMock.mockResolvedValueOnce(
    generation({
      status: "succeeded",
      result: {
        assets: [
          { type: "image", url: "https://api.seeapi.com/assets/last.png" },
          { type: "video", url: "https://api.seeapi.com/assets/out.mp4", mime_type: "video/mp4" },
        ],
      },
    }),
  );

  expect(await seeapiProvider.result("task_1")).toEqual({
    status: "succeeded",
    url: "https://api.seeapi.com/assets/out.mp4",
  });
});

test.each(["failed", "canceled", "refunded", "expired"])("treats %s as failed", async (status) => {
  fetchMock.mockResolvedValueOnce(generation({ status }));

  expect(await seeapiProvider.result("task_1")).toEqual({
    status: "failed",
    code: status,
    error: expect.stringContaining(status),
  });
});

test("fails a succeeded task without a video", async () => {
  fetchMock.mockResolvedValueOnce(generation({ status: "succeeded", result: { assets: [] } }));

  expect(await seeapiProvider.result("task_1")).toMatchObject({ status: "failed" });
});

test("throws when SeeAPI can't be reached, so the caller retries later", async () => {
  fetchMock.mockResolvedValueOnce(json({}, 503));

  await expect(seeapiProvider.result("task_1")).rejects.toThrow(VideoGenerationError);
});
