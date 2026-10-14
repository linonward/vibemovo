import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { auth } from "./index";

const email = `user-${randomUUID()}@example.com`;

afterAll(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.findUserByEmail(email);
  if (user) await ctx.internalAdapter.deleteUser(user.user.id);
});

test("stores and finds users in Postgres", async () => {
  const ctx = await auth.$context;

  await ctx.internalAdapter.createUser(
    { email, name: "Test User" },
    { method: "admin" },
  );
  const found = await ctx.internalAdapter.findUserByEmail(email);

  expect(found?.user).toMatchObject({ email, name: "Test User" });
});
