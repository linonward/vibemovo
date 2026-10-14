import { captcha } from "better-auth/plugins";

type Env = Record<string, string | undefined>;

// Cloudflare Turnstile in front of magic-link sign-in, so a script can't
// sign up accounts in bulk for their signup credits. Google sign-in costs a
// Google account and stays open. Off unless the secret is set; the startup
// check requires the site key with it.
export function captchaPlugins(env: Env = process.env) {
  const secretKey = env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return [];

  // The plugin's defaults cover email and password, not magic links.
  return [captcha({ provider: "cloudflare-turnstile", secretKey, endpoints: ["/sign-in/magic-link"] })];
}
