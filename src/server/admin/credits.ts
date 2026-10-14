import { eq } from "drizzle-orm";
import { user } from "@/server/auth/schema";
import { grantCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { notify } from "@/server/notifications";

export class UnknownUserError extends Error {
  constructor() {
    super("Unknown user");
    this.name = "UnknownUserError";
  }
}

export class InvalidAddCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAddCreditsError";
  }
}

export const MAX_ADMIN_CREDITS = 1_000_000;

// Adds credits by hand as an "admin" ledger entry and notifies the user.
// requestId is one per submission, so a double click or a retry adds the
// credits, and notifies, once.
// Returns the new balance.
export async function addCredits({
  userId,
  amount,
  requestId,
}: {
  userId: string;
  amount: number;
  requestId: string;
}): Promise<number> {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_ADMIN_CREDITS) {
    throw new InvalidAddCreditsError(`Amount must be a whole number from 1 to ${MAX_ADMIN_CREDITS}`);
  }
  if (!requestId || requestId.length > 100) throw new InvalidAddCreditsError("Invalid request ID");

  const [found] = await getDb().select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (!found) throw new UnknownUserError();

  const key = `admin:${requestId}`;
  const balance = await grantCredits({ userId, amount, reason: "admin", idempotencyKey: key });
  await notify(userId, key, { type: "credits_added", data: { credits: amount } });
  return balance;
}
