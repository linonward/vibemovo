import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePendingPoll } from "./use-pending-poll";

const fetchMock = vi.fn<(url: string) => Promise<Response>>();
const onBody = vi.fn<(id: string, body: unknown) => void>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  onBody.mockReset();
  setVisibility("visible");
});

const reply = (status: number, body: object = {}) => new Response(JSON.stringify(body), { status });

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function poll(ids: string[]) {
  return renderHook(({ ids }) => usePendingPoll({ ids, intervalMs: 1000, url: (id) => `/api/jobs/${id}`, onBody }), {
    initialProps: { ids },
  });
}

// Lets the timer fire and the fetches settle.
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const urls = () => fetchMock.mock.calls.map(([url]) => url);

test("asks about each id every interval and hands over the bodies", async () => {
  fetchMock.mockImplementation(async () => reply(200, { status: "pending" }));
  poll(["a", "b"]);

  await tick(999);
  expect(fetchMock).not.toHaveBeenCalled();
  await tick(1);
  expect(urls()).toEqual(["/api/jobs/a", "/api/jobs/b"]);
  expect(onBody).toHaveBeenCalledWith("a", { status: "pending" });

  await tick(1000);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("stops for good once the session is gone", async () => {
  fetchMock.mockImplementation(async () => reply(401, { error: "UNAUTHORIZED" }));
  poll(["a", "b"]);

  await tick(1000);
  await tick(60_000);

  expect(urls()).toEqual(["/api/jobs/a"]);
  expect(onBody).not.toHaveBeenCalled();
});

test("drops an id the server doesn't know and keeps the rest", async () => {
  fetchMock.mockImplementation(async (url) => (url.endsWith("/a") ? reply(404) : reply(200, {})));
  poll(["a", "b"]);

  await tick(1000);
  await tick(1000);

  expect(urls()).toEqual(["/api/jobs/a", "/api/jobs/b", "/api/jobs/b"]);
});

test("backs off while the server fails, then returns to the interval", async () => {
  fetchMock.mockImplementation(async () => reply(502));
  poll(["a"]);

  await tick(1000); // 1st try fails
  await tick(1999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await tick(1); // 2nd try after 2 s
  expect(fetchMock).toHaveBeenCalledTimes(2);

  fetchMock.mockImplementation(async () => reply(200, {}));
  await tick(4000); // 3rd try after 4 s succeeds
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await tick(1000); // back to 1 s
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("never waits longer than a minute between tries", async () => {
  fetchMock.mockImplementation(async () => {
    throw new TypeError("offline");
  });
  poll(["a"]);

  for (const ms of [1000, 2000, 4000, 8000, 16_000, 32_000, 60_000, 60_000]) await tick(ms);

  expect(fetchMock).toHaveBeenCalledTimes(8);
});

test("pauses while the page is hidden", async () => {
  fetchMock.mockImplementation(async () => reply(200, {}));
  poll(["a"]);

  act(() => setVisibility("hidden"));
  await tick(10_000);
  expect(fetchMock).not.toHaveBeenCalled();

  act(() => setVisibility("visible"));
  await tick(1000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("does nothing without ids", async () => {
  poll([]);
  await tick(10_000);
  expect(fetchMock).not.toHaveBeenCalled();
});
