import { projectConfig } from "project.config";
import type { Email } from "@/server/email/client";
import { actionEmail } from "./action";

// The provider couldn't charge the card. It retries on its own schedule; the
// user keeps the subscription by updating the payment method.
export function subscriptionPastDueEmail(to: string, billingUrl: string): Email {
  const { name } = projectConfig;
  return actionEmail(
    to,
    `Your ${name} payment didn't go through`,
    `We couldn't charge your card for your ${name} subscription. Update your payment method to keep it.`,
    "Update your payment method",
    billingUrl,
  );
}

export function subscriptionEndedEmail(to: string, billingUrl: string): Email {
  const { name } = projectConfig;
  return actionEmail(
    to,
    `Your ${name} subscription has ended`,
    `Your ${name} subscription has ended, and it no longer adds credits each month. Credits you already have stay in your account.`,
    "Subscribe again",
    billingUrl,
  );
}
