// @vitest-environment node
import { expect, test, vi } from "vitest";

vi.mock("project.config", () => ({ projectConfig: { name: "Acme & Co" } }));

const { videoFailedEmail, videoReadyEmail } = await import("./video");

const page = "http://localhost:3000/videos/v1";

test("a finished video names its prompt and links to its page", () => {
  const email = videoReadyEmail("ada@example.com", "A fox <runs>", page);

  expect(email.to).toBe("ada@example.com");
  expect(email.subject).toBe("Your Acme & Co video is ready");
  expect(email.text).toContain("“A fox <runs>”");
  expect(email.text).toContain(page);
  expect(email.html).toContain("A fox &lt;runs&gt;");
  expect(email.html).toContain(`href="${page}"`);
});

test("a failed video says the credits came back", () => {
  const email = videoFailedEmail("ada@example.com", "A fox", 20, "http://localhost:3000/videos");

  expect(email.subject).toBe("Your Acme & Co video couldn't be made");
  expect(email.text).toContain("20 credits were refunded");
  expect(email.text).toContain("http://localhost:3000/videos");
});

test("shortens a long prompt", () => {
  const email = videoReadyEmail("ada@example.com", "x".repeat(300), page);

  expect(email.text).toContain(`“${"x".repeat(99)}…”`);
  expect(email.text).not.toContain("x".repeat(101));
});
