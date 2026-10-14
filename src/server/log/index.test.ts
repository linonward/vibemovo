import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { log, onErrorLogged } from ".";

const out = vi.fn<(line: string) => void>();
const err = vi.fn<(line: string) => void>();

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(out);
  vi.spyOn(console, "debug").mockImplementation(out);
  vi.spyOn(console, "warn").mockImplementation(err);
  vi.spyOn(console, "error").mockImplementation(err);
  vi.useFakeTimers({ now: new Date("2026-10-12T08:00:00.000Z") });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  out.mockReset();
  err.mockReset();
});

const json = (line: string) => JSON.parse(line);

test("writes one JSON line per event in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  log.info("image.succeeded", { id: "img-1", userId: "u-1", ms: 1200 });

  expect(out).toHaveBeenCalledTimes(1);
  expect(out.mock.calls[0][0]).toMatch(/^\{"time":"[^"]+","level":"info","event":"image\.succeeded",/);
  expect(json(out.mock.calls[0][0])).toEqual({
    time: "2026-10-12T08:00:00.000Z",
    level: "info",
    event: "image.succeeded",
    id: "img-1",
    userId: "u-1",
    ms: 1200,
  });
});

test("fields can't overwrite the time, level or event", () => {
  vi.stubEnv("LOG_FORMAT", "json");
  log.info("a.b", { level: "error", event: "x", time: "never" });

  expect(json(out.mock.calls[0][0])).toMatchObject({ level: "info", event: "a.b", time: "2026-10-12T08:00:00.000Z" });
});

test("writes warnings and errors to stderr, with the error's name, message, stack and cause", () => {
  vi.stubEnv("LOG_FORMAT", "json");
  const error = new TypeError("boom", { cause: new Error("root") });
  log.error("images.submit_failed", { error, userId: "u-1" });
  log.warn("cron.slow");

  expect(out).not.toHaveBeenCalled();
  const line = json(err.mock.calls[0][0]);
  expect(line).toMatchObject({ level: "error", userId: "u-1" });
  expect(line.error).toMatchObject({ name: "TypeError", message: "boom", cause: { message: "root" } });
  expect(line.error.stack).toContain("TypeError: boom");
  expect(json(err.mock.calls[1][0])).toMatchObject({ level: "warn", event: "cron.slow" });
});

test("skips events below LOG_LEVEL, which defaults to info", () => {
  vi.stubEnv("LOG_FORMAT", "json");
  log.debug("hidden");
  vi.stubEnv("LOG_LEVEL", "warn");
  log.info("hidden");
  log.warn("shown");
  vi.stubEnv("LOG_LEVEL", "debug");
  log.debug("shown");

  expect([...out.mock.calls, ...err.mock.calls].map(([line]) => json(line).event)).toEqual(["shown", "shown"]);
});

test("writes a readable line outside production", () => {
  vi.stubEnv("NODE_ENV", "development");
  log.info("image.failed", { id: "img-1", error: "Bad prompt here", credits: 1 });

  expect(out.mock.calls[0][0]).toBe('INFO  image.failed id=img-1 error="Bad prompt here" credits=1');
});

test("prints the stack under a readable error line", () => {
  vi.stubEnv("NODE_ENV", "development");
  log.error("chat.failed", { error: new Error("boom") });

  const [line] = err.mock.calls[0];
  expect(line).toMatch(/^ERROR chat\.failed error="boom"\nError: boom\n/);
});

test("never throws on values JSON can't write", () => {
  vi.stubEnv("LOG_FORMAT", "json");
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  expect(() => log.info("odd", { circular, big: BigInt(1) })).not.toThrow();
  expect(json(out.mock.calls[0][0])).toMatchObject({ event: "odd", big: "1" });
});

test("hands error events to listeners, even when the line can't be written", () => {
  const listener = vi.fn();
  const stop = onErrorLogged(listener);
  err.mockImplementation(() => {
    throw new Error("stderr closed");
  });
  const error = new Error("boom");

  log.warn("image.slow", { id: "img-1" });
  log.error("image.failed", { id: "img-1", error });
  stop();
  log.error("image.failed", { id: "img-2" });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith("image.failed", { id: "img-1", error });
});

test("a listener that throws doesn't fail the caller", () => {
  const stop = onErrorLogged(() => {
    throw new Error("listener broke");
  });

  expect(() => log.error("image.failed")).not.toThrow();
  stop();
});

// Next.js bundles instrumentation.ts apart from the routes, so each gets its
// own copy of this module. A listener added in one must hear the other.
test("listeners are shared between copies of the module", async () => {
  vi.resetModules();
  const other = await import(".");
  const listener = vi.fn();
  const stop = onErrorLogged(listener);

  other.log.error("payment.unknown_order");
  stop();

  expect(other.log).not.toBe(log);
  expect(listener).toHaveBeenCalledWith("payment.unknown_order", {});
});
