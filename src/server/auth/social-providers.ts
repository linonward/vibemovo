import type { BetterAuthOptions } from "better-auth";

type Env = Record<string, string | undefined>;

// Google is enabled only when both credentials are set, so local setups
// without a Google OAuth client still work with magic links.
export function socialProviders(
  env: Env = process.env,
): NonNullable<BetterAuthOptions["socialProviders"]> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return {};

  return {
    google: {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  };
}
