// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { INDEXNOW_ENDPOINT, submitUrls } from "./index";

const key = "0123456789abcdef";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

test("submits the URLs with the key and where to find it", async () => {
  const urls = ["https://example.com/en", "https://example.com/en/blog/post"];

  await expect(submitUrls(urls, key)).resolves.toEqual({ submitted: 2, status: 200 });

  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(INDEXNOW_ENDPOINT);
  expect(init.method).toBe("POST");
  expect(init.headers).toEqual({ "content-type": "application/json; charset=utf-8" });
  expect(JSON.parse(init.body)).toEqual({
    host: "example.com",
    key,
    keyLocation: "https://example.com/indexnow.txt",
    urlList: urls,
  });
});

test("splits more than 10,000 URLs into several requests", async () => {
  const urls = Array.from({ length: 10_001 }, (_, i) => `https://example.com/p/${i}`);

  await expect(submitUrls(urls, key)).resolves.toEqual({ submitted: 10_001, status: 200 });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).urlList).toHaveLength(10_000);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).urlList).toEqual(["https://example.com/p/10000"]);
});

test("stops at the first refusal and reports its status", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
  const urls = Array.from({ length: 10_001 }, (_, i) => `https://example.com/p/${i}`);

  await expect(submitUrls(urls, key)).resolves.toEqual({ submitted: 0, status: 403 });
  expect(fetchMock).toHaveBeenCalledOnce();
});

test("refuses URLs on another host", async () => {
  await expect(submitUrls(["https://example.com/a", "https://other.com/b"], key)).rejects.toThrow(
    "https://other.com/b is not on example.com",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("sends nothing without a key or URLs", async () => {
  await expect(submitUrls(["https://example.com/a"], undefined)).rejects.toThrow("INDEXNOW_KEY is not set");
  await expect(submitUrls([], key)).resolves.toEqual({ submitted: 0, status: null });
  expect(fetchMock).not.toHaveBeenCalled();
});
