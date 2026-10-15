import { createHash } from "node:crypto";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Each worktree gets its own port (3100-3899, stable per path) so parallel
// worktrees never reuse each other's server. Override with E2E_PORT.
const PORT =
  Number(process.env.E2E_PORT) ||
  3100 + (createHash("sha1").update(process.cwd()).digest().readUInt16BE(0) % 800);
export const BASE_URL = `http://localhost:${PORT}`;
export const EMAIL_OUTBOX_DIR = path.resolve("e2e/.outbox");
export const GOOGLE_CLIENT_ID = "e2e-google-client-id";
export const STRIPE_WEBHOOK_SECRET = "whsec_e2e";
export const ADMIN_EMAIL = "admin@example.com";
export const CRON_SECRET = "e2e-cron-secret-0123456789abcdef0123";
export const INDEXNOW_KEY = "e2e0123456789abcdef";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      BETTER_AUTH_URL: BASE_URL,
      // Fixed, so E2E doesn't depend on the local .env.
      BETTER_AUTH_SECRET: "e2e-better-auth-secret-0123456789abcdef",
      ADMIN_EMAILS: ADMIN_EMAIL,
      CRON_SECRET,
      INDEXNOW_KEY,
      RESEND_API_KEY: "",
      EMAIL_OUTBOX_DIR,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: "e2e-google-client-secret",
      // Payments stay off: E2E can't reach a provider's checkout. Webhooks
      // still verify, so signed test events reach the handler.
      PAYMENT_PROVIDER: "",
      STRIPE_WEBHOOK_SECRET,
      // Chat replies come from an echo model, and images stay off: E2E
      // doesn't call Bailian.
      AI_MOCK: "1",
      DASHSCOPE_API_KEY: "",
      // Videos stay off: E2E doesn't call fal or SeeAPI.
      VIDEO_PROVIDER: "",
    },
    timeout: 120_000,
  },
});
