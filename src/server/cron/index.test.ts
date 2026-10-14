import { beforeEach, expect, test, vi } from "vitest";
import { sweepStaleImages } from "@/server/images";
import { log } from "@/server/log";
import { grantYearlyMonths } from "@/server/payment/subscriptions";
import { expireUploads, sweepStaleVideos } from "@/server/videos";
import { isCronRequest, sweepPending } from "./index";

vi.mock("@/server/images", () => ({ sweepStaleImages: vi.fn() }));
vi.mock("@/server/videos", () => ({ sweepStaleVideos: vi.fn(), expireUploads: vi.fn() }));
vi.mock("@/server/payment/subscriptions", () => ({ grantYearlyMonths: vi.fn() }));
vi.mock("@/server/log", () => ({ log: { error: vi.fn() } }));

const tasks = {
  images: vi.mocked(sweepStaleImages),
  videos: vi.mocked(sweepStaleVideos),
  subscriptionMonths: vi.mocked(grantYearlyMonths),
  uploads: vi.mocked(expireUploads),
};

beforeEach(() => {
  vi.resetAllMocks();
  tasks.images.mockResolvedValue({ failed: 1, checked: 2 });
  tasks.videos.mockResolvedValue({ failed: 3, checked: 4 });
  tasks.subscriptionMonths.mockResolvedValue(5);
  tasks.uploads.mockResolvedValue(6);
});

const secret = "s".repeat(32);
const headers = (authorization?: string) =>
  new Headers(authorization ? { authorization } : {});

test("accepts the bearer CRON_SECRET", () => {
  expect(isCronRequest(headers(`Bearer ${secret}`), secret)).toBe(true);
});

test("rejects a wrong, missing or partial secret", () => {
  expect(isCronRequest(headers(`Bearer ${"x".repeat(32)}`), secret)).toBe(false);
  expect(isCronRequest(headers(`Bearer ${secret.slice(1)}`), secret)).toBe(false);
  expect(isCronRequest(headers(secret), secret)).toBe(false);
  expect(isCronRequest(headers(), secret)).toBe(false);
});

test("rejects everything while CRON_SECRET is unset", () => {
  expect(isCronRequest(headers("Bearer "), undefined)).toBe(false);
  expect(isCronRequest(headers("Bearer "), "")).toBe(false);
});

test.each(["images", "videos", "subscriptionMonths", "uploads"] as const)(
  "runs every task and reports the failure when %s fails",
  async (task) => {
    const error = new Error(`${task} unavailable`);
    tasks[task].mockRejectedValueOnce(error);

    const failure = await sweepPending().catch((error: unknown) => error);

    for (const run of Object.values(tasks)) expect(run).toHaveBeenCalledTimes(1);
    expect(failure).toMatchObject({ errors: [error] });
    expect(log.error).toHaveBeenCalledExactlyOnceWith("cron.task_failed", { task, error });
  },
);

test("returns each task's counts when all succeed", async () => {
  await expect(sweepPending()).resolves.toEqual({
    images: { failed: 1, checked: 2 },
    videos: { failed: 3, checked: 4 },
    subscriptionMonths: 5,
    uploads: 6,
  });
  expect(log.error).not.toHaveBeenCalled();
});

test("waits for unfinished tasks and reports every failure", async () => {
  const imageError = new Error("images unavailable");
  const videoError = new Error("videos unavailable");
  const months = Promise.withResolvers<number>();
  tasks.images.mockRejectedValueOnce(imageError);
  tasks.videos.mockRejectedValueOnce(videoError);
  tasks.subscriptionMonths.mockReturnValueOnce(months.promise);
  const settled = vi.fn();
  const result = sweepPending().catch((error: unknown) => {
    settled();
    return error;
  });

  await vi.waitFor(() => expect(tasks.subscriptionMonths).toHaveBeenCalledTimes(1));
  expect(settled).not.toHaveBeenCalled();
  months.resolve(5);

  expect(await result).toMatchObject({ errors: [imageError, videoError] });
  expect(log.error).toHaveBeenCalledTimes(2);
  expect(log.error).toHaveBeenCalledWith("cron.task_failed", { task: "images", error: imageError });
  expect(log.error).toHaveBeenCalledWith("cron.task_failed", { task: "videos", error: videoError });
});
