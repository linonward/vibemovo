import { desc, eq, like, sql } from "drizzle-orm";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { MAX_BROADCAST_BODY, MAX_BROADCAST_TITLE, RECENT_BROADCASTS } from "./config";
import { broadcast, notification } from "./schema";

export class InvalidBroadcastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBroadcastError";
  }
}

export class UnknownRecipientError extends Error {
  constructor() {
    super("No user has this email");
    this.name = "UnknownRecipientError";
  }
}

export type Broadcast = typeof broadcast.$inferSelect;

// Sends a notification with the admin's text to one user (by email,
// ignoring case) or, without an email, to every user who exists now.
// requestId is one per submission: a repeat returns the first broadcast,
// and finishes sending it if a crash stopped it halfway.
export async function sendBroadcast(input: {
  title: string;
  body: string;
  email?: string;
  requestId: string;
  sentBy: string;
}): Promise<Broadcast> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > MAX_BROADCAST_TITLE) {
    throw new InvalidBroadcastError(`Title must be 1-${MAX_BROADCAST_TITLE} characters`);
  }
  if (!body || body.length > MAX_BROADCAST_BODY) {
    throw new InvalidBroadcastError(`Message must be 1-${MAX_BROADCAST_BODY} characters`);
  }
  if (!input.requestId || input.requestId.length > 100) throw new InvalidBroadcastError("Invalid request ID");

  const db = getDb();
  let email: string | null = null;
  if (input.email?.trim()) {
    const [found] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(sql`lower(${user.email})`, input.email.trim().toLowerCase()));
    if (!found) throw new UnknownRecipientError();
    email = found.email;
  }

  await db
    .insert(broadcast)
    .values({ requestId: input.requestId, title, body, email, sentBy: input.sentBy })
    .onConflictDoNothing({ target: broadcast.requestId });
  const [sent] = await db.select().from(broadcast).where(eq(broadcast.requestId, input.requestId));

  // One statement for every recipient; the keys skip users a retry already reached.
  await db.execute(sql`
    insert into ${notification} (id, user_id, type, data, key)
    select gen_random_uuid()::text, ${user.id}, 'broadcast',
      jsonb_build_object('broadcastId', ${sent.id}::text, 'title', ${sent.title}::text, 'body', ${sent.body}::text),
      'broadcast:' || ${sent.id} || ':' || ${user.id}
    from ${user}
    ${sent.email ? sql`where ${user.email} = ${sent.email}` : sql``}
    on conflict (key) do nothing`);

  const recipients = await db.$count(notification, like(notification.key, `broadcast:${sent.id}:%`));
  const [updated] = await db.update(broadcast).set({ recipients }).where(eq(broadcast.id, sent.id)).returning();
  return updated;
}

export function listBroadcasts(limit = RECENT_BROADCASTS): Promise<Broadcast[]> {
  return getDb().select().from(broadcast).orderBy(desc(broadcast.createdAt), desc(broadcast.id)).limit(limit);
}
