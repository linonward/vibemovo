import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { getSession, hitLimit } = vi.hoisted(() => ({
  getSession: vi.fn<(headers: Headers) => Promise<unknown>>(),
  hitLimit: vi.fn<(key: string, limit: object) => Promise<{ allowed: boolean; retryAfterMs?: number }>>(),
}));
vi.mock("@/server/auth/session", () => ({ getSession }));
vi.mock("@/server/ratelimit", () => ({ hitLimit }));

const { withSession } = await import("./with-session");

const session = { user: { id: "u1", email: "ada@example.com" } };
const handler = vi.fn(async () => Response.json({ ok: true }));

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
  getSession.mockResolvedValue(session);
  hitLimit.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const request = (method: string, headers: Record<string, string> = {}) =>
  new Request("https://app.example.com/api/things", { method, headers });

test("answers 401 without a session and never runs the handler", async () => {
  getSession.mockResolvedValue(null);

  const response = await withSession(handler)(request("GET"));

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  expect(handler).not.toHaveBeenCalled();
});

test("passes the session and the awaited params to the handler", async () => {
  const route = withSession<{ id: string }>(async (_request, { session, params }) =>
    Response.json({ user: (session as typeof session).user.id, id: params.id }),
  );

  const response = await route(request("GET"), { params: Promise.resolve({ id: "x" }) });

  expect(await response.json()).toEqual({ user: "u1", id: "x" });
});

test.each(["POST", "PUT", "PATCH", "DELETE"])("%s needs the app's own Origin", async (method) => {
  const route = withSession(handler);

  const foreign: Record<string, string>[] = [{}, { origin: "https://evil.example" }, { origin: "https://app.example.com.evil" }];
  for (const headers of foreign) {
    const response = await route(request(method, headers));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN_ORIGIN" });
  }
  expect(handler).not.toHaveBeenCalled();

  expect((await route(request(method, { origin: "https://app.example.com" }))).status).toBe(200);
});

test("GET needs no Origin", async () => {
  expect((await withSession(handler)(request("GET"))).status).toBe(200);
});

test("counts each user's hits per limit name, and answers 429 with Retry-After when over", async () => {
  const limit = { name: "image-poll", max: 10, windowMs: 60_000 };
  const route = withSession(handler, { limit });

  expect((await route(request("GET"))).status).toBe(200);
  expect(hitLimit).toHaveBeenCalledWith("api:image-poll:u1", limit);

  hitLimit.mockResolvedValue({ allowed: false, retryAfterMs: 12_300 });
  const response = await route(request("GET"));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("13");
  expect(await response.json()).toEqual({ error: "RATE_LIMITED" });
});

test("checks the Origin before it counts a hit", async () => {
  await withSession(handler, { limit: { name: "x", max: 1, windowMs: 1 } })(request("POST"));

  expect(hitLimit).not.toHaveBeenCalled();
});

const withKey = (method: string, headers: Record<string, string> = {}) =>
  request(method, { "x-api-key": "sk_test", ...headers });

test("refuses an API key on a route that doesn't allow keys, without checking it", async () => {
  const response = await withSession(handler)(withKey("GET"));

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "API_KEY_NOT_ALLOWED" });
  expect(getSession).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
});

test("accepts an API key where allowed, with no Origin, since no cookie rides along", async () => {
  const route = withSession(handler, { apiKey: true });

  expect((await route(withKey("POST"))).status).toBe(200);
  expect((await route(withKey("POST", { origin: "https://evil.example" }))).status).toBe(200);
  expect(handler).toHaveBeenCalledTimes(2);
});

test("still checks the Origin of cookie requests on a route that allows keys", async () => {
  expect((await withSession(handler, { apiKey: true })(request("POST"))).status).toBe(403);
});

test("answers 401 INVALID_API_KEY for a key the auth plugin refuses", async () => {
  for (const status of ["FORBIDDEN", "UNAUTHORIZED"]) {
    getSession.mockRejectedValueOnce(Object.assign(new Error("Invalid API key."), { status, body: { code: "X" } }));
    const response = await withSession(handler, { apiKey: true })(withKey("GET"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "INVALID_API_KEY" });
  }
});

test("answers 429 with Retry-After when the key is over its own limit", async () => {
  getSession.mockRejectedValueOnce(
    Object.assign(new Error("Rate limit exceeded."), {
      status: "TOO_MANY_REQUESTS",
      body: { code: "RATE_LIMITED", details: { tryAgainIn: 4_200 } },
    }),
  );

  const response = await withSession(handler, { apiKey: true })(withKey("GET"));

  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("5");
  expect(await response.json()).toEqual({ error: "RATE_LIMITED" });
});
