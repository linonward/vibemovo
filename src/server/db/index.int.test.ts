import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { getDb } from "./index";

test("connects to Postgres", async () => {
  const result = await getDb().execute(sql`select 1 as ok`);
  expect(result.rows).toEqual([{ ok: 1 }]);
});
