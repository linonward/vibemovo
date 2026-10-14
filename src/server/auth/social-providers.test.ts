// @vitest-environment node
import { expect, test } from "vitest";
import { socialProviders } from "./social-providers";

test("enables Google when both credentials are set", () => {
  expect(
    socialProviders({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }),
  ).toEqual({
    google: {
      clientId: "id",
      clientSecret: "secret",
      prompt: "select_account",
    },
  });
});

test("leaves Google off when a credential is missing", () => {
  expect(socialProviders({ GOOGLE_CLIENT_ID: "id" })).toEqual({});
  expect(socialProviders({ GOOGLE_CLIENT_SECRET: "secret" })).toEqual({});
  expect(socialProviders({})).toEqual({});
});
