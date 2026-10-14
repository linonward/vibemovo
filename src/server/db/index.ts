import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let db: NodePgDatabase<typeof schema> | undefined;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(url, { schema });
  }
  return db;
}

// The client or an open transaction, for functions that can join the
// caller's transaction.
export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
