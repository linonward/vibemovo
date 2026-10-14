// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return { emails: { send } };
  }),
}));

vi.mock("project.config", () => ({ projectConfig: { name: "Acme" } }));

const { sendEmail } = await import("./client");

const email = {
  to: "ada@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
};

let outbox: string;

beforeEach(async () => {
  outbox = await mkdtemp(join(tmpdir(), "outbox-"));
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  send.mockReset();
  await rm(outbox, { recursive: true, force: true });
});

test("sends through Resend when RESEND_API_KEY is set", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "starter <hello@example.com>");
  send.mockResolvedValue({ data: { id: "1" }, error: null });

  await sendEmail(email);

  expect(send).toHaveBeenCalledWith({
    from: "starter <hello@example.com>",
    ...email,
  });
});

test("sends from the project's name on Resend's test address without EMAIL_FROM", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "");
  send.mockResolvedValue({ data: { id: "1" }, error: null });

  await sendEmail(email);

  expect(send).toHaveBeenCalledWith({ from: "Acme <onboarding@resend.dev>", ...email });
});

test("throws when Resend returns an error", async () => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  send.mockResolvedValue({
    data: null,
    error: { name: "validation_error", message: "Invalid from" },
  });

  await expect(sendEmail(email)).rejects.toThrow("Invalid from");
});

test("refuses to drop emails in production without RESEND_API_KEY", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_OUTBOX_DIR", "");

  await expect(sendEmail(email)).rejects.toThrow("RESEND_API_KEY is not set");
  expect(send).not.toHaveBeenCalled();
});

test("logs and writes to the outbox without RESEND_API_KEY", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_OUTBOX_DIR", outbox);

  await sendEmail(email);

  expect(send).not.toHaveBeenCalled();
  expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Hi"));
  const saved = JSON.parse(
    await readFile(join(outbox, "ada@example.com.json"), "utf8"),
  );
  expect(saved).toEqual(email);
});
