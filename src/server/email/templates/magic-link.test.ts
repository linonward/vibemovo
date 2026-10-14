// @vitest-environment node
import { expect, test, vi } from "vitest";

vi.mock("project.config", () => ({ projectConfig: { name: "Acme & Co" } }));

const { magicLinkEmail } = await import("./magic-link");

test("names the project from project.config", () => {
  const email = magicLinkEmail("ada@example.com", "http://localhost:3000/verify");

  expect(email.subject).toBe("Sign in to Acme & Co");
  expect(email.text).toMatch(/^Sign in to Acme & Co:/);
  expect(email.html).toContain(">Sign in to Acme &amp; Co</a>");
});

test("puts the link in both the text and HTML bodies", () => {
  const url = "http://localhost:3000/api/auth/magic-link/verify?token=abc";

  const email = magicLinkEmail("ada@example.com", url);

  expect(email.to).toBe("ada@example.com");
  expect(email.text).toContain(url);
  expect(email.html).toContain(`href="${url}"`);
});

test("escapes the link in the HTML body", () => {
  const email = magicLinkEmail("ada@example.com", 'http://x/?a="><script>');

  expect(email.html).not.toContain("<script>");
  expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
});
