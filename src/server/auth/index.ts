import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { afterDeleteUser, beforeDeleteUser, LiveSubscriptionError } from "@/server/account";
import { grantCredits } from "@/server/credits";
import { signupCredits } from "@/server/credits/config";
import { getDb } from "@/server/db";
import * as schema from "@/server/db/schema";
import { sendEmail } from "@/server/email/client";
import { magicLinkEmail } from "@/server/email/templates/magic-link";
import { apiKeys, limitApiKeys } from "./api-keys";
import { captchaPlugins } from "./captcha";
import { ipAddressHeaders } from "./client-ip";
import { socialProviders } from "./social-providers";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  socialProviders: socialProviders(),
  // On by default in production only. The database shares the counters
  // between server instances; memory would give each its own. The
  // magic-link plugin allows 5 requests a minute per IP.
  rateLimit: { storage: "database" },
  advanced: {
    ipAddress: { ipAddressHeaders: ipAddressHeaders() },
  },
  // Deleting requires a fresh session (signed in within session.freshAge,
  // 1 day by default). Sessions, accounts, orders, subscriptions, chats,
  // images and videos cascade with the user; afterDelete removes the stored
  // files.
  user: {
    deleteUser: {
      enabled: true,
      // The provider would keep charging a live subscription, so the user
      // cancels it first.
      beforeDelete: async (user) => {
        try {
          await beforeDeleteUser(user.id);
        } catch (error) {
          if (!(error instanceof LiveSubscriptionError)) throw error;
          throw new APIError("BAD_REQUEST", { code: "ACTIVE_SUBSCRIPTION", message: error.message });
        }
      },
      afterDelete: (user) => afterDeleteUser(user.id),
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Runs after the user row commits. The key makes a retry safe.
        after: async (user) => {
          if (signupCredits <= 0) return;
          await grantCredits({
            userId: user.id,
            amount: signupCredits,
            reason: "signup",
            idempotencyKey: `signup:${user.id}`,
          });
        },
      },
    },
  },
  hooks: { before: limitApiKeys },
  plugins: [
    apiKeys(),
    magicLink({
      sendMagicLink: ({ email, url }) => sendEmail(magicLinkEmail(email, url)),
    }),
    ...captchaPlugins(),
  ],
});
