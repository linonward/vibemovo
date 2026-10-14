import { expect, test } from "@playwright/test";

test("health check reports the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});
