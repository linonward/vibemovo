import { eq } from "drizzle-orm";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { sendEmail } from "@/server/email/client";
import { subscriptionEndedEmail, subscriptionPastDueEmail } from "@/server/email/templates/subscription";
import { log } from "@/server/log";

const TEMPLATES = {
  past_due: subscriptionPastDueEmail,
  ended: subscriptionEndedEmail,
};

export type BillingEmail = keyof typeof TEMPLATES;

// Emails the subscriber about a change they should act on or know about.
// Callers send it only when notify stored a new notification, so a repeated
// webhook sends nothing twice. The link opens /billing, which redirects to
// the reader's locale. A lost email is logged, never thrown: the webhook
// still succeeds.
export async function emailSubscriber(userId: string, email: BillingEmail): Promise<void> {
  try {
    const [found] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (!found) return;
    const billingUrl = new URL("/billing", process.env.BETTER_AUTH_URL).href;
    await sendEmail(TEMPLATES[email](found.email, billingUrl));
  } catch (error) {
    log.error("payment.email_failed", { userId, email, error });
  }
}
