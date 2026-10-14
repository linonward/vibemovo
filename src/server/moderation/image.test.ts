// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { checkImage, imageModerationEnabled, ModerationUnavailableError } from "./image";
import { ContentBlockedError } from "./index";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("IMAGE_MODERATION", "seeapi");
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

const task = (fields: object, status = 200) =>
  json({ id: "inf_1", object: "inference", model: "nsfw-filter", result: null, error: null, ...fields }, status);

const done = (flagged: boolean, nsfw: string[] = []) =>
  task({ status: "succeeded", result: { type: "json", data: { flagged, categories: { nsfw, special_care: [] } } } });

const fast = { pollMs: 0, timeoutMs: 1000 };

test("is on only with IMAGE_MODERATION=seeapi", () => {
  expect(imageModerationEnabled()).toBe(true);
  vi.stubEnv("IMAGE_MODERATION", "");
  expect(imageModerationEnabled()).toBe(false);
});

test("submits the image URL to SeeAPI's NSFW filter, then polls until it finishes", async () => {
  fetchMock
    .mockResolvedValueOnce(task({ status: "queued" }, 202))
    .mockResolvedValueOnce(task({ status: "processing" }))
    .mockResolvedValueOnce(done(false));

  await checkImage("https://storage.test/in.png?signed", "video:1", fast);

  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://api.seeapi.com/v1/inferences");
  expect(init?.method).toBe("POST");
  expect(init?.headers).toMatchObject({ authorization: "Bearer see-test", "idempotency-key": "moderation:video:1" });
  expect(JSON.parse(String(init?.body))).toEqual({
    model: "nsfw-filter",
    endpoint: "image-moderation",
    provider: "seeapi",
    input: { image_url: "https://storage.test/in.png?signed" },
  });
  expect(fetchMock.mock.calls[1][0]).toBe("https://api.seeapi.com/v1/inferences/inf_1");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("a flagged image is blocked, naming its labels", async () => {
  fetchMock.mockResolvedValueOnce(task({ status: "queued" }, 202)).mockResolvedValueOnce(done(true, ["explicit"]));

  const check = checkImage("https://storage.test/in.png", "video:1", fast);

  await expect(check).rejects.toBeInstanceOf(ContentBlockedError);
  await expect(check).rejects.toThrow("explicit");
});

test.each([
  ["the request fails", () => fetchMock.mockResolvedValueOnce(json({ error: { code: "x" } }, 503))],
  ["the network fails", () => fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))],
  [
    "the task reports an error",
    () =>
      fetchMock
        .mockResolvedValueOnce(task({ status: "queued" }, 202))
        .mockResolvedValueOnce(task({ status: "failed", error: { code: "download_failed", message: "no" } })),
  ],
  [
    "it succeeds without a verdict",
    () => fetchMock.mockResolvedValueOnce(task({ status: "queued" }, 202)).mockResolvedValueOnce(task({ status: "succeeded" })),
  ],
])("fails closed when %s", async (_, arrange) => {
  arrange();
  await expect(checkImage("https://storage.test/in.png", "video:1", fast)).rejects.toBeInstanceOf(
    ModerationUnavailableError,
  );
});

test("fails closed when the check doesn't finish in time", async () => {
  fetchMock.mockImplementation(async () => task({ status: "processing" }));

  await expect(
    checkImage("https://storage.test/in.png", "video:1", { pollMs: 1, timeoutMs: 20 }),
  ).rejects.toBeInstanceOf(ModerationUnavailableError);
});
