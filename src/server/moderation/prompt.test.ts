// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ContentBlockedError, ModerationUnavailableError } from "./index";
import { screenPrompt } from "./prompt";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const fetchMock = vi.fn<typeof fetch>();
const reply = (data: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify({ data }), { status, headers });

beforeEach(() => {
  vi.stubEnv("PROMPT_MODERATION", "waffo");
  vi.stubEnv("WAFFO_MERCHANT_ID", "MER_2aUyqjCzEIiEcYMKj7TZtw");
  vi.stubEnv("WAFFO_PRIVATE_KEY", privateKey.replace(/\n/g, "\\n"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

test("signs a Waffo semantic check and accepts only allow", async () => {
  fetchMock.mockResolvedValue(reply({ action: "allow" }));
  await expect(screenPrompt("A fox running")).resolves.toBeUndefined();
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe("https://api.waffo.ai/v1/actions/verification/scan-prompt");
  expect(JSON.parse(init!.body as string)).toEqual({ prompt: "A fox running", semantic: "enforce" });
  const headers = new Headers(init!.headers);
  expect(headers.get("X-Merchant-Id")).toBe("MER_2aUyqjCzEIiEcYMKj7TZtw");
  expect(headers.get("X-Signature")).toBeTruthy();
  expect(init!.signal).toBeInstanceOf(AbortSignal);
});

test("keeps the local blocklist ahead of the remote check", async () => {
  await expect(screenPrompt("CSAM")).rejects.toThrow(ContentBlockedError);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("leaves remote screening off when unconfigured", async () => {
  vi.stubEnv("PROMPT_MODERATION", "");
  await expect(screenPrompt("A fox")).resolves.toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("blocks a denied verdict", async () => {
  fetchMock.mockResolvedValue(reply({ action: "block" }));
  await expect(screenPrompt("A fox")).rejects.toThrow(ContentBlockedError);
});

test.each([{ action: "review" }, { action: "review", reasonCode: "service_degraded" }, {}, null, { action: "unknown" }])(
  "refuses generation without an allow verdict: %j", async (verdict) => {
    fetchMock.mockResolvedValue(reply(verdict));
    await expect(screenPrompt("A fox")).rejects.toThrow(ModerationUnavailableError);
  },
);

test.each([401, 500])("fails closed on HTTP %s without leaking prompt text", async (status) => {
  fetchMock.mockResolvedValue(reply({ action: "allow" }, status));
  await expect(screenPrompt("private prompt")).rejects.toThrow(ModerationUnavailableError);
});

test("preserves the rate limit retry delay", async () => {
  fetchMock.mockResolvedValue(reply(null, 429, { "Retry-After": "47" }));
  await expect(screenPrompt("A fox")).rejects.toMatchObject({ retryAfter: 47 });
});

test("fails closed on timeout", async () => {
  fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
  await expect(screenPrompt("A fox")).rejects.toThrow(ModerationUnavailableError);
});

test("fails closed when enabled without credentials", async () => {
  vi.stubEnv("WAFFO_PRIVATE_KEY", "");
  await expect(screenPrompt("A fox")).rejects.toThrow(ModerationUnavailableError);
  expect(fetchMock).not.toHaveBeenCalled();
});
