import { z } from "zod";
import { VIDEO_PROVIDER_IDS } from "./ai/video/types";
import { PROVIDER_IDS } from "./payment/providers/types";

type Env = Record<string, string | undefined>;

const required = { error: "required" };
// "a, b or c".
const choices = (ids: readonly string[]) => `${ids.slice(0, -1).join(", ")} or ${ids.at(-1)}`;
const optional = <T extends z.ZodType>(schema: T) => schema.optional();
const httpUrl = z.url({ protocol: /^https?$/, error: "must be an http(s) URL" });

// The format of each variable on its own.
const schema = z.object({
  DATABASE_URL: z.string(required).regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  BETTER_AUTH_SECRET: z.string(required).min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.string(required).pipe(httpUrl),
  CRON_SECRET: optional(z.string().min(32, "must be at least 32 characters")),
  INDEXNOW_KEY: optional(z.string().regex(/^[A-Za-z0-9-]{8,128}$/, "must be 8-128 letters, digits or hyphens")),
  CLIENT_IP_HEADER: optional(z.string().trim().regex(/^[A-Za-z0-9-]+$/, "must be one header name")),
  ADMIN_EMAILS: optional(
    z.string().refine(
      (value) => value.split(",").every((email) => !email.trim() || /^[^\s@]+@[^\s@]+$/.test(email.trim())),
      "must be emails separated by commas",
    ),
  ),
  PAYMENT_PROVIDER: z.enum(PROVIDER_IDS, `must be ${choices(PROVIDER_IDS)}, or empty`).optional(),
  STRIPE_SECRET_KEY: optional(z.string().regex(/^(sk|rk)_/, "must start with sk_ or rk_")),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith("whsec_", "must start with whsec_")),
  WAFFO_MERCHANT_ID: optional(z.string().startsWith("MER_", "must start with MER_")),
  WAFFO_PRIVATE_KEY: optional(
    z.string().regex(/-----BEGIN (RSA )?PRIVATE KEY-----/, "must be a PEM private key"),
  ),
  WAFFO_ENVIRONMENT: z.enum(["test", "prod"], "must be test or prod, or empty").optional(),
  DEEPSEEK_API_KEY: optional(z.string().startsWith("sk-", "must start with sk-")),
  DASHSCOPE_BASE_URL: optional(z.string().pipe(httpUrl)),
  VIDEO_PROVIDER: z.enum(VIDEO_PROVIDER_IDS, `must be ${choices(VIDEO_PROVIDER_IDS)}, or empty`).optional(),
  IMAGE_MODERATION: z.enum(["seeapi"], "must be seeapi, or empty").optional(),
  STORAGE_ENDPOINT: optional(z.string().pipe(httpUrl)),
  STORAGE_FORCE_PATH_STYLE: z.enum(["true", "false"], "must be true or false, or empty").optional(),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.string().pipe(httpUrl)),
  NEXT_PUBLIC_VERCEL_ANALYTICS: z.enum(["1"], "must be 1, or empty").optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"], "must be debug, info, warn or error, or empty").optional(),
  LOG_FORMAT: z.enum(["json", "pretty"], "must be json or pretty, or empty").optional(),
});

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// Rules that span several variables.
function crossChecks(env: Env): string[] {
  const problems: string[] = [];
  const bothOrNeither = (a: string, b: string) => {
    if (env[a] && !env[b]) problems.push(`${b}: required when ${a} is set`);
    if (env[b] && !env[a]) problems.push(`${a}: required when ${b} is set`);
  };
  const requireFor = (provider: string, names: string[]) => {
    for (const name of names) {
      if (!env[name]) problems.push(`${name}: required when PAYMENT_PROVIDER is ${provider}`);
    }
  };

  bothOrNeither("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  // A secret without the site key would reject every magic link.
  bothOrNeither("TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY");

  // Mirrors sendEmail: production needs Resend unless an outbox catches mail.
  if (env.NODE_ENV === "production" && !env.EMAIL_OUTBOX_DIR) {
    if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY: required in production");
    else if (!env.EMAIL_FROM) {
      problems.push("EMAIL_FROM: required in production when RESEND_API_KEY is set");
    }
  }

  if (env.NODE_ENV === "production") {
    // A public server, not a production build on localhost (as in E2E).
    const url = URL.parse(env.BETTER_AUTH_URL ?? "");
    if (url && !LOCAL_HOSTS.includes(url.hostname)) {
      if (url.protocol !== "https:") problems.push("BETTER_AUTH_URL: must be https:// in production");
      for (const name of ["AI_MOCK", "EMAIL_OUTBOX_DIR"]) {
        if (env[name]) problems.push(`${name}: test-only, not allowed in production`);
      }
    }
    // Without the sweep, abandoned images and videos keep their credits.
    const generation = ["DASHSCOPE_API_KEY", "VIDEO_PROVIDER"].find((name) => env[name]);
    if (generation && !env.CRON_SECRET) {
      problems.push(`CRON_SECRET: required in production when ${generation} is set`);
    }
    // Without it, yearly subscribers get only the first month's credits.
    // Mirrors the providers' configured("yearly").
    const yearly =
      env.PAYMENT_PROVIDER === "stripe" ||
      (env.PAYMENT_PROVIDER === "waffo" && !!env.WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID);
    if (!generation && yearly && !env.CRON_SECRET) {
      problems.push("CRON_SECRET: required in production when yearly plans are on sale");
    }
  }

  if (env.PAYMENT_PROVIDER === "stripe") {
    requireFor("stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
  }
  if (env.PAYMENT_PROVIDER === "waffo") {
    requireFor("waffo", ["WAFFO_MERCHANT_ID", "WAFFO_PRIVATE_KEY"]);
    const subscriptions = env.WAFFO_SUBSCRIPTION_PRODUCT_ID && env.WAFFO_STORE_ID;
    if (!env.WAFFO_PRODUCT_ID && !subscriptions) {
      problems.push(
        "WAFFO_PRODUCT_ID: set it, or WAFFO_SUBSCRIPTION_PRODUCT_ID and WAFFO_STORE_ID, when PAYMENT_PROVIDER is waffo",
      );
    }
  }
  bothOrNeither("WAFFO_SUBSCRIPTION_PRODUCT_ID", "WAFFO_STORE_ID");
  // Yearly plans are sold on top of the monthly ones.
  if (env.WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID && !env.WAFFO_SUBSCRIPTION_PRODUCT_ID) {
    problems.push("WAFFO_SUBSCRIPTION_PRODUCT_ID: required when WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID is set");
  }

  if (env.VIDEO_PROVIDER === "fal" && !env.FAL_KEY) {
    problems.push("FAL_KEY: required when VIDEO_PROVIDER is fal");
  }
  if (env.VIDEO_PROVIDER === "seeapi" && !env.SEEAPI_API_KEY) {
    problems.push("SEEAPI_API_KEY: required when VIDEO_PROVIDER is seeapi");
  }
  if (env.VIDEO_PROVIDER === "dashscope" && !env.DASHSCOPE_API_KEY) {
    problems.push("DASHSCOPE_API_KEY: required when VIDEO_PROVIDER is dashscope");
  }
  if (env.IMAGE_MODERATION === "seeapi" && !env.SEEAPI_API_KEY) {
    problems.push("SEEAPI_API_KEY: required when IMAGE_MODERATION is seeapi");
  }

  // Images and videos are copied to storage, so Bailian and the video
  // provider need it; storage needs its keys.
  const storage = ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"];
  const storageTrigger = ["DASHSCOPE_API_KEY", "VIDEO_PROVIDER", ...storage].find((name) => env[name]);
  if (storageTrigger) {
    for (const name of storage) {
      if (!env[name]) problems.push(`${name}: required when ${storageTrigger} is set`);
    }
  }

  return problems;
}

// Lists every problem with the environment as "NAME: reason", never the
// value. Empty values count as unset, like the blank lines in .env.example.
export function validateEnv(raw: Env): string[] {
  const env = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ""));
  const result = schema.safeParse(env);
  const formats = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  return [...formats, ...crossChecks(env)];
}

// Throws one error listing every problem, so a misconfigured server fails
// at startup instead of later (or quietly turning payments off).
export function assertValidEnv(env: Env = process.env): void {
  const problems = validateEnv(env);
  if (problems.length === 0) return;
  throw new Error(
    `Invalid environment. Fix these variables (see docs/runbook.md):\n${problems.map((p) => `- ${p}`).join("\n")}`,
  );
}

// A variable the startup check guarantees once its feature is on. Throws
// if it's missing anyway, naming it, instead of passing undefined on.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
