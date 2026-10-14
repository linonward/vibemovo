// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { submitUrls } from "@/server/indexnow";
import { POST } from "./route";

vi.mock("@/app/sitemap", () => ({ default: vi.fn() }));
vi.mock("@/server/indexnow", () => ({ submitUrls: vi.fn() }));
vi.mock("@/server/cron", () => ({
  isCronRequest: (headers: Headers) => headers.get("authorization") === "Bearer secret",
}));
vi.mock("@/server/log", () => ({ log: { info: vi.fn(), warn: vi.fn() } }));

const post = (authorization?: string) =>
  POST(new Request("http://localhost/api/indexnow", { method: "POST", headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("INDEXNOW_KEY", "0123456789abcdef");
  vi.mocked(sitemap).mockResolvedValue([{ url: "https://example.com/en" }, { url: "https://example.com/zh" }]);
  vi.mocked(submitUrls).mockResolvedValue({ submitted: 2, status: 200 });
});

test("submits every sitemap URL", async () => {
  const response = await post("Bearer secret");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ submitted: 2, status: 200 });
  expect(submitUrls).toHaveBeenCalledWith(["https://example.com/en", "https://example.com/zh"]);
});

test("answers 502 when the search engines refuse", async () => {
  vi.mocked(submitUrls).mockResolvedValue({ submitted: 0, status: 403 });

  const response = await post("Bearer secret");

  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ submitted: 0, status: 403 });
});

test("is not there without the secret or a key", async () => {
  expect((await post()).status).toBe(404);
  expect((await post("Bearer wrong")).status).toBe(404);

  vi.stubEnv("INDEXNOW_KEY", "");
  expect((await post("Bearer secret")).status).toBe(404);
  expect(submitUrls).not.toHaveBeenCalled();
});
