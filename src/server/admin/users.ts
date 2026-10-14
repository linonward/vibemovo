import { count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { user } from "@/server/auth/schema";
import { creditBalance } from "@/server/credits/schema";
import { getDb } from "@/server/db";

export type AdminUser = Awaited<ReturnType<typeof listUsers>>["users"][number];

export const USERS_PAGE_SIZE = 50;

// No balance row means a balance of zero.
const balance = sql<number>`coalesce(${creditBalance.balance}, 0)`.mapWith(Number);

// One page of users, newest first, with their credit balance. `query` matches
// part of the email or name, ignoring case. `total` counts every match, so
// the page can link to the rest.
export async function listUsers({
  query = "",
  page = 1,
  pageSize = USERS_PAGE_SIZE,
}: { query?: string; page?: number; pageSize?: number } = {}) {
  const db = getDb();
  const term = query.trim();
  // Escape LIKE wildcards so they match literally.
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const where = term ? or(ilike(user.email, pattern), ilike(user.name, pattern)) : undefined;

  const [users, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        balance,
      })
      .from(user)
      .leftJoin(creditBalance, eq(creditBalance.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(pageSize)
      .offset((Math.max(1, page) - 1) * pageSize),
    db.select({ total: count() }).from(user).where(where),
  ]);
  return { users, total };
}

// One user with their credit balance, or null if the id is unknown.
export async function getUser(id: string) {
  const [row] = await getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      balance,
    })
    .from(user)
    .leftJoin(creditBalance, eq(creditBalance.userId, user.id))
    .where(eq(user.id, id));
  return row ?? null;
}
