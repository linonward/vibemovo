import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { auth } from "@/server/auth";
import { signupCredits } from "@/server/credits/config";
import { getUser, listUsers } from "./users";

// Other tests create users in the same database concurrently, so assert
// properties of the list rather than exact counts or neighbours.
test("lists the newest users first with the total count", async () => {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Newest" },
    { method: "admin" },
  );

  const { users, total } = await listUsers({ pageSize: 20 });

  // Not compared with a count taken earlier: other files delete users too.
  expect(total).toBeGreaterThanOrEqual(users.length);
  expect(users.length).toBeLessThanOrEqual(20);
  expect(users.map((u) => u.email)).toContain(created.email);
  const times = users.map((u) => u.createdAt.getTime());
  expect(times).toEqual([...times].sort((a, b) => b - a));
  expect(Object.keys(users[0]).sort()).toEqual(["balance", "createdAt", "email", "id", "name"]);

  await ctx.internalAdapter.deleteUser(created.id);
});

test("finds users by part of their email or name, ignoring case", async () => {
  const ctx = await auth.$context;
  const tag = randomUUID().slice(0, 8);
  const byEmail = await ctx.internalAdapter.createUser(
    { email: `find-${tag}@example.com`, name: "Someone" },
    { method: "admin" },
  );
  const byName = await ctx.internalAdapter.createUser(
    { email: `other-${randomUUID()}@example.com`, name: `Grace ${tag.toUpperCase()}` },
    { method: "admin" },
  );

  const { users, total } = await listUsers({ query: ` ${tag} ` });

  expect(total).toBe(2);
  expect(users.map((u) => u.id).sort()).toEqual([byEmail.id, byName.id].sort());

  await ctx.internalAdapter.deleteUser(byEmail.id);
  await ctx.internalAdapter.deleteUser(byName.id);
});

test("treats % and _ in the query as plain characters", async () => {
  const { users, total } = await listUsers({ query: `%_${randomUUID()}` });

  expect(total).toBe(0);
  expect(users).toEqual([]);
});

test("pages through the matches", async () => {
  const ctx = await auth.$context;
  const tag = randomUUID().slice(0, 8);
  const created = [];
  for (let i = 0; i < 3; i++) {
    created.push(
      await ctx.internalAdapter.createUser(
        { email: `page-${tag}-${i}@example.com`, name: "Paged" },
        { method: "admin" },
      ),
    );
  }

  const first = await listUsers({ query: tag, page: 1, pageSize: 2 });
  const second = await listUsers({ query: tag, page: 2, pageSize: 2 });

  expect(first.total).toBe(3);
  expect(second.total).toBe(3);
  expect(first.users).toHaveLength(2);
  expect(second.users).toHaveLength(1);
  const ids = [...first.users, ...second.users].map((u) => u.id);
  expect(new Set(ids).size).toBe(3);

  for (const u of created) await ctx.internalAdapter.deleteUser(u.id);
});

test("gets one user with their balance, or null for an unknown id", async () => {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { email: `one-${randomUUID()}@example.com`, name: "One" },
    { method: "admin" },
  );

  const found = await getUser(created.id);

  expect(found).toEqual({
    id: created.id,
    name: "One",
    email: created.email,
    emailVerified: false,
    createdAt: created.createdAt,
    balance: signupCredits,
  });
  expect(await getUser(randomUUID())).toBeNull();

  await ctx.internalAdapter.deleteUser(created.id);
});
