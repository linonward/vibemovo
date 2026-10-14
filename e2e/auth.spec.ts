import { expect, test } from "@playwright/test";

test("auth API reports no session for a signed-out visitor", async ({
  request,
}) => {
  const response = await request.get("/api/auth/get-session");

  expect(response.status()).toBe(200);
  expect(await response.json()).toBeNull();
});
