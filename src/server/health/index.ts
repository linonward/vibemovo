import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export type Health =
  | { status: "ok"; database: "ok" }
  | { status: "error"; database: "unreachable" };

export async function checkHealth(): Promise<Health> {
  try {
    await getDb().execute(sql`select 1`);
    return { status: "ok", database: "ok" };
  } catch {
    return { status: "error", database: "unreachable" };
  }
}
