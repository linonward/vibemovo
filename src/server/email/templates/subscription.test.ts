// @vitest-environment node
import { expect, test, vi } from "vitest";

vi.mock("project.config", () => ({ projectConfig: { name: "Acme & Co" } }));

const { subscriptionEndedEmail, subscriptionPastDueEmail } = await import("./subscription");

const billing = "http://localhost:3000/billing";

test("a failed charge asks the user to update the payment method on the billing page", () => {
  const email = subscriptionPastDueEmail("ada@example.com", billing);

  expect(email.to).toBe("ada@example.com");
  expect(email.subject).toBe("Your Acme & Co payment didn't go through");
  expect(email.text).toContain(billing);
  expect(email.html).toContain(`href="${billing}"`);
  expect(email.html).toContain("Acme &amp; Co");
});

test("an ended subscription says the credits stay and links to the billing page", () => {
  const email = subscriptionEndedEmail("ada@example.com", billing);

  expect(email.subject).toBe("Your Acme & Co subscription has ended");
  expect(email.text).toMatch(/credits you already have stay/i);
  expect(email.text).toContain(billing);
  expect(email.html).toContain(`href="${billing}"`);
});

test("escapes the link in the HTML body", () => {
  const email = subscriptionPastDueEmail("ada@example.com", 'http://x/?a="><script>');

  expect(email.html).not.toContain("<script>");
});
