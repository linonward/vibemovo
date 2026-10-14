import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { uniqueEmail } from "./support/auth";
import { rateLimitKeys } from "./support/db";

// Counters live in the database, so every server instance shares them.
test("magic-link requests are limited per IP, with counters in the database", async ({ request }) => {
  const ip = `10.250.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
  const ask = () =>
    request.post("/api/auth/sign-in/magic-link", {
      data: { email: uniqueEmail(), callbackURL: "/en/dashboard" },
      headers: { origin: BASE_URL, "x-forwarded-for": ip },
    });

  for (let i = 0; i < 5; i++) expect((await ask()).status()).toBe(200);
  expect((await ask()).status()).toBe(429);
  expect(await rateLimitKeys(ip)).not.toEqual([]);
});
