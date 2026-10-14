import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { hitLimit } from "./index";

const limit = { max: 3, windowMs: 60_000 };

test("allows up to max hits per window, then refuses with the wait", async () => {
  const key = `test:${randomUUID()}`;
  const now = 1_000_000;

  for (let hit = 0; hit < 3; hit++) expect(await hitLimit(key, limit, now + hit)).toEqual({ allowed: true });
  expect(await hitLimit(key, limit, now + 10_000)).toEqual({ allowed: false, retryAfterMs: 50_000 });
});

test("starts a new window once the old one has passed", async () => {
  const key = `test:${randomUUID()}`;
  const now = 1_000_000;
  for (let hit = 0; hit < 4; hit++) await hitLimit(key, limit, now);

  expect(await hitLimit(key, limit, now + 60_000)).toEqual({ allowed: true });
  expect(await hitLimit(key, limit, now + 60_001)).toEqual({ allowed: true });
});

test("counts each key on its own", async () => {
  const [a, b] = [`test:${randomUUID()}`, `test:${randomUUID()}`];
  for (let hit = 0; hit < 3; hit++) await hitLimit(a, limit, 0);

  expect((await hitLimit(a, limit, 0)).allowed).toBe(false);
  expect((await hitLimit(b, limit, 0)).allowed).toBe(true);
});

test("counts hits that arrive together", async () => {
  const key = `test:${randomUUID()}`;
  const results = await Promise.all(Array.from({ length: 6 }, () => hitLimit(key, limit, 0)));

  expect(results.filter((r) => r.allowed)).toHaveLength(3);
});
