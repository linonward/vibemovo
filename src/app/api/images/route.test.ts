// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { createImage } from "@/server/images";
import { ContentBlockedError, ModerationUnavailableError } from "@/server/moderation";
import { POST } from "./route";

vi.mock("@/app/api/_lib/with-session", () => ({
  withSession: (handler: (request: Request, context: object) => Promise<Response>) =>
    (request: Request) => handler(request, { session: { user: { id: "user-1" } } }),
}));
vi.mock("@/server/images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/images")>()),
  createImage: vi.fn(),
}));
vi.mock("@/server/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

const post = () => POST(new Request("http://localhost/api/images", {
  method: "POST",
  body: JSON.stringify({ prompt: "A fox", aspect: "1:1" }),
}));

test("an unavailable screening verdict returns 503 and the retry delay", async () => {
  vi.mocked(createImage).mockRejectedValueOnce(new ModerationUnavailableError("review", undefined, 3600));
  const response = await post();
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("3600");
  expect(await response.json()).toEqual({ error: "MODERATION_UNAVAILABLE" });
});

test("a denied screening verdict returns the content-blocked response", async () => {
  vi.mocked(createImage).mockRejectedValueOnce(new ContentBlockedError("Waffo blocked the prompt"));
  const response = await post();
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "CONTENT_BLOCKED" });
});
