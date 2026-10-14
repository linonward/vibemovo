import { expect, test } from "vitest";
import { apiError } from "./api";

test("apiError answers { error } with the status", async () => {
  const response = apiError("INSUFFICIENT_CREDITS", 402);
  expect(response.status).toBe(402);
  expect(await response.json()).toEqual({ error: "INSUFFICIENT_CREDITS" });
});
