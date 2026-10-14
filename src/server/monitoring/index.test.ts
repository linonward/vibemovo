// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { log } from "@/server/log";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRequestError: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => sentry);

const { initMonitoring, reportRequestError } = await import("./index");

const dsn = "https://key@o1.ingest.sentry.io/2";
let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
  for (const fn of Object.values(sentry)) fn.mockReset();
});

test("stays off without a DSN", async () => {
  expect(await initMonitoring({})).toBeUndefined();
  await reportRequestError({ dsn: undefined }, new Error("x"), {} as never, {} as never);

  expect(sentry.init).not.toHaveBeenCalled();
  expect(sentry.captureRequestError).not.toHaveBeenCalled();
});

test("with a DSN, starts Sentry and reports logged errors", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  stop = await initMonitoring({ NEXT_PUBLIC_SENTRY_DSN: dsn });

  expect(sentry.init).toHaveBeenCalledWith({ dsn });

  const error = new Error("Bailian timed out");
  log.error("image.failed", { id: "img-1", error });
  expect(sentry.captureException).toHaveBeenCalledWith(error, {
    tags: { event: "image.failed" },
    extra: { id: "img-1", error },
  });

  // An event with no Error still reports, named after the event.
  log.error("payment.unknown_order", { provider: "stripe" });
  const [reported, context] = sentry.captureException.mock.calls[1];
  expect(reported).toBeInstanceOf(Error);
  expect((reported as Error).message).toBe("payment.unknown_order");
  expect(context).toEqual({ tags: { event: "payment.unknown_order" }, extra: { provider: "stripe" } });
});

test("with a DSN, reports errors from requests", async () => {
  const error = new Error("render failed");
  const request = { path: "/en/dashboard", method: "GET", headers: {} };
  const context = { routerKind: "App Router", routePath: "/[locale]/dashboard", routeType: "render" };

  await reportRequestError({ dsn }, error, request as never, context as never);

  expect(sentry.captureRequestError).toHaveBeenCalledWith(error, request, context);
});
