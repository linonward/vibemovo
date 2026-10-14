type Env = Record<string, string | undefined>;

// The one request header Better Auth takes the client IP from, for rate
// limits. Trust only the header your host overwrites: a client can send any
// other one with a fake address and get a fresh rate-limit bucket each time.
// Vercel and most proxies set x-forwarded-for; Cloudflare sets
// cf-connecting-ip.
export function ipAddressHeaders(env: Env = process.env): string[] {
  return [env.CLIENT_IP_HEADER?.trim().toLowerCase() || "x-forwarded-for"];
}
