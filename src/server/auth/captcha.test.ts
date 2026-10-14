// @vitest-environment node
import { expect, test } from "vitest";
import { captchaPlugins } from "./captcha";

const on = { TURNSTILE_SECRET_KEY: "secret" };

// The plugin's request hook, called the way Better Auth calls it.
async function send(path: string, headers: Record<string, string> = {}) {
  const [plugin] = captchaPlugins(on);
  const request = new Request(`http://localhost:3000/api/auth${path}`, { method: "POST", headers });
  return plugin.onRequest!(request, { options: {} } as never);
}

test("is off without a Turnstile secret", () => {
  expect(captchaPlugins({})).toEqual([]);
});

test("rejects a magic-link request without a Turnstile token", async () => {
  const result = await send("/sign-in/magic-link");

  expect(result && "response" in result ? result.response.status : undefined).toBe(400);
});

test("leaves Google sign-in and other auth requests alone", async () => {
  expect(await send("/sign-in/social")).toBeUndefined();
  expect(await send("/get-session")).toBeUndefined();
  expect(await send("/magic-link/verify")).toBeUndefined();
});
