import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ImageGenerationError, imageResult, submitImage } from "./dashscope";

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

const task = (output: object) => json({ request_id: "req-1", output: { task_id: "task-1", ...output } });

test("queues one image with Bailian and returns the task ID", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  const taskId = await submitImage({ prompt: "A flower shop", size: "1280*1280" });

  expect(taskId).toBe("task-1");
  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation");
  const headers = new Headers(init?.headers);
  expect(headers.get("authorization")).toBe("Bearer sk-test");
  expect(headers.get("x-dashscope-async")).toBe("enable");
  expect(JSON.parse(init?.body as string)).toEqual({
    model: "wan2.6-t2i",
    input: { messages: [{ role: "user", content: [{ text: "A flower shop" }] }] },
    parameters: { n: 1, size: "1280*1280", watermark: false, prompt_extend: true },
  });
});

test("uses the configured base URL and model", async () => {
  vi.stubEnv("DASHSCOPE_BASE_URL", "https://ws-1.cn-beijing.maas.aliyuncs.com/");
  vi.stubEnv("DASHSCOPE_IMAGE_MODEL", "wan2.6-t2i-preview");
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));
  fetchMock.mockResolvedValueOnce(task({ task_status: "RUNNING" }));

  await submitImage({ prompt: "x", size: "1280*1280" });
  await imageResult("task-1");

  const [submitted, init] = fetchMock.mock.calls[0];
  expect(submitted).toBe("https://ws-1.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/image-generation/generation");
  expect(JSON.parse(init?.body as string).model).toBe("wan2.6-t2i-preview");
  expect(fetchMock.mock.calls[1][0]).toBe("https://ws-1.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1");
});

test("reports Bailian's error code when it refuses the task", async () => {
  fetchMock.mockResolvedValueOnce(
    json({ request_id: "req-2", code: "DataInspectionFailed", message: "Input data may contain inappropriate content." }, 400),
  );

  const error = await submitImage({ prompt: "x", size: "1280*1280" }).catch((e) => e);

  expect(error).toBeInstanceOf(ImageGenerationError);
  expect(error.code).toBe("DataInspectionFailed");
});

test("fails when Bailian returns no task ID", async () => {
  fetchMock.mockResolvedValueOnce(json({ output: {} }));

  await expect(submitImage({ prompt: "x", size: "1280*1280" })).rejects.toThrow(ImageGenerationError);
});

test.each(["PENDING", "RUNNING"])("a %s task is pending", async (task_status) => {
  fetchMock.mockResolvedValueOnce(task({ task_status }));

  expect(await imageResult("task-1")).toEqual({ status: "pending" });
  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://dashscope.aliyuncs.com/api/v1/tasks/task-1");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-test");
});

test("a finished task returns the image URL", async () => {
  fetchMock.mockResolvedValueOnce(
    task({
      task_status: "SUCCEEDED",
      finished: true,
      choices: [
        {
          finish_reason: "stop",
          message: { role: "assistant", content: [{ type: "image", image: "https://oss.test/a.png" }] },
        },
      ],
    }),
  );

  expect(await imageResult("task-1")).toEqual({ status: "succeeded", url: "https://oss.test/a.png" });
});

test("a failed task returns Bailian's code", async () => {
  fetchMock.mockResolvedValueOnce(
    task({ task_status: "FAILED", code: "DataInspectionFailed", message: "Output data may contain inappropriate content." }),
  );

  expect(await imageResult("task-1")).toEqual({
    status: "failed",
    code: "DataInspectionFailed",
    error: expect.stringContaining("Output data may contain inappropriate content."),
  });
});

test.each(["CANCELED", "UNKNOWN"])("a %s task failed", async (task_status) => {
  fetchMock.mockResolvedValueOnce(task({ task_status }));

  expect(await imageResult("task-1")).toMatchObject({ status: "failed" });
});

test("a finished task without an image failed", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "SUCCEEDED", choices: [] }));

  expect(await imageResult("task-1")).toMatchObject({ status: "failed" });
});

test("throws when Bailian can't answer, so the caller retries", async () => {
  fetchMock.mockResolvedValueOnce(json({ code: "InternalError", message: "busy" }, 500));

  await expect(imageResult("task-1")).rejects.toThrow(ImageGenerationError);
});
