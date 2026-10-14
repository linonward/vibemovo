// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// vercel.json schedules the sweep on Vercel. Keep it pointed at a route
// that exists, as often as docs/runbook.md says.
const root = new URL("../../../../../", import.meta.url);
const { crons } = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8")) as {
  crons: { path: string; schedule: string }[];
};

test("Vercel Cron calls the sweep every 10 minutes", () => {
  expect(crons).toEqual([{ path: "/api/cron/sweep", schedule: "*/10 * * * *" }]);
  for (const { path } of crons) {
    expect(existsSync(new URL(`src/app${path}/route.ts`, root))).toBe(true);
  }
});
