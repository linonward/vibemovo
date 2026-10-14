import { desc, eq, inArray, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "@/server/db";
import { log } from "@/server/log";
import { creditBalance, creditTransaction } from "./schema";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export type CreditChange = {
  userId: string;
  // A positive whole number. spendCredits subtracts it.
  amount: number;
  reason: string;
  // Unique per change. Repeating a key returns the current balance and
  // changes nothing, so callers can retry safely.
  idempotencyKey: string;
  // Joins the caller's transaction, so the change commits or rolls back
  // with the caller's other writes.
  tx?: Tx;
};

export async function getBalance(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ balance: creditBalance.balance })
    .from(creditBalance)
    .where(eq(creditBalance.userId, userId));
  return row?.balance ?? 0;
}

// Newest first. Grants have a positive amount, spends a negative one.
export function listTransactions(userId: string, { limit = 50 }: { limit?: number } = {}) {
  return getDb()
    .select({
      id: creditTransaction.id,
      amount: creditTransaction.amount,
      reason: creditTransaction.reason,
      createdAt: creditTransaction.createdAt,
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.userId, userId))
    .orderBy(desc(creditTransaction.createdAt), desc(creditTransaction.id))
    .limit(limit);
}

// The idempotency keys among `keys` that a change has already used. Lets a
// batch job skip changes it made before without a transaction per change.
export async function usedIdempotencyKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await getDb()
    .select({ key: creditTransaction.idempotencyKey })
    .from(creditTransaction)
    .where(inArray(creditTransaction.idempotencyKey, keys));
  return new Set(rows.map((row) => row.key));
}

export function grantCredits(change: CreditChange): Promise<number> {
  return apply(change, change.amount);
}

export async function spendCredits(change: CreditChange): Promise<number> {
  try {
    return await apply(change, -change.amount);
  } catch (error) {
    if (violates(error, "credit_balance_non_negative")) throw new InsufficientCreditsError();
    throw error;
  }
}

// Spends up to `amount`: all of it, or the whole balance if that is less.
// Returns the credits taken. For taking back credits the user may already
// have spent. A repeated key takes nothing and returns 0.
export async function spendUpTo(change: CreditChange): Promise<number> {
  const db: Db | Tx = change.tx ?? getDb();
  return db.transaction(async (tx) => {
    // The lock keeps a spend between reading the balance and taking it
    // from overdrawing.
    const [row] = await tx
      .select({ balance: creditBalance.balance })
      .from(creditBalance)
      .where(eq(creditBalance.userId, change.userId))
      .for("update");
    const amount = Math.min(change.amount, row?.balance ?? 0);
    if (amount <= 0) return 0;
    const before = row.balance;
    const after = await spendCredits({ ...change, amount, tx });
    return before - after;
  });
}

// Writes the ledger row and the balance in one transaction, a savepoint
// inside `tx` when one is given.
async function apply(change: CreditChange, delta: number): Promise<number> {
  if (!Number.isInteger(change.amount) || change.amount <= 0) {
    throw new RangeError(`Credit amount must be a positive integer, got ${change.amount}`);
  }

  let changed = false;
  const db: Db | Tx = change.tx ?? getDb();
  const balance = await db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(creditTransaction)
      .values({
        userId: change.userId,
        amount: delta,
        reason: change.reason,
        idempotencyKey: change.idempotencyKey,
      })
      .onConflictDoNothing({ target: creditTransaction.idempotencyKey })
      .returning({ id: creditTransaction.id });

    if (!entry) {
      const [row] = await tx
        .select({ balance: creditBalance.balance })
        .from(creditBalance)
        .where(eq(creditBalance.userId, change.userId));
      return row?.balance ?? 0;
    }

    const set = { balance: sql`${creditBalance.balance} + ${delta}`, updatedAt: new Date() };
    // Postgres checks constraints on the proposed insert row before it
    // resolves a conflict, so a spend must update, never upsert.
    const [row] =
      delta > 0
        ? await tx
            .insert(creditBalance)
            .values({ userId: change.userId, balance: delta })
            .onConflictDoUpdate({ target: creditBalance.userId, set })
            .returning({ balance: creditBalance.balance })
        : await tx
            .update(creditBalance)
            .set(set)
            .where(eq(creditBalance.userId, change.userId))
            .returning({ balance: creditBalance.balance });
    // No balance row means a balance of zero.
    if (!row) throw new InsufficientCreditsError();
    changed = true;
    return row.balance;
  });
  if (changed) log.info("credits.changed", { userId: change.userId, delta, reason: change.reason, balance });
  return balance;
}

// Drizzle wraps driver errors, so look through the cause chain.
function violates(error: unknown, constraint: string): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ("constraint" in e && e.constraint === constraint) return true;
  }
  return false;
}
