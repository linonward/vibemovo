// @vitest-environment node
import { expect, test, vi } from "vitest";
import { VIDEO_PROVIDER_IDS } from "./ai/video/types";
import { assertValidEnv, requireEnv, validateEnv } from "./env";
import { PROVIDER_IDS } from "./payment/providers/types";

const base = {
  DATABASE_URL: "postgres://starter:starter@localhost:5432/starter",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

const production = {
  ...base,
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://app.example.com",
  RESEND_API_KEY: "re_live",
  EMAIL_FROM: "starter <hello@example.com>",
};

const stripe = {
  PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_test_1",
  STRIPE_WEBHOOK_SECRET: "whsec_1",
};

const waffo = {
  PAYMENT_PROVIDER: "waffo",
  WAFFO_MERCHANT_ID: "MER_1",
  WAFFO_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
  WAFFO_PRODUCT_ID: "PROD_1",
};

test("accepts the minimal local setup from .env.example", () => {
  expect(validateEnv(base)).toEqual([]);
});

test("accepts a full production setup", () => {
  expect(validateEnv({ ...production, ...stripe, CRON_SECRET: "c".repeat(32) })).toEqual([]);
  expect(validateEnv({ ...production, ...waffo, WAFFO_ENVIRONMENT: "prod" })).toEqual([]);
  expect(validateEnv({ ...production, DEEPSEEK_API_KEY: "sk-1", DEEPSEEK_MODEL: "deepseek-v4-pro" })).toEqual([]);
});

test("treats empty values as unset, like the blank lines in .env.example", () => {
  expect(validateEnv({ ...base, GOOGLE_CLIENT_ID: "", PAYMENT_PROVIDER: "", WAFFO_ENVIRONMENT: "" })).toEqual([]);
});

test.each([
  ["DATABASE_URL", { DATABASE_URL: undefined }],
  ["DATABASE_URL", { DATABASE_URL: "mysql://localhost/db" }],
  ["BETTER_AUTH_SECRET", { BETTER_AUTH_SECRET: undefined }],
  ["BETTER_AUTH_SECRET", { BETTER_AUTH_SECRET: "short" }],
  ["BETTER_AUTH_URL", { BETTER_AUTH_URL: "localhost:3000" }],
])("reports a missing or malformed %s", (name, override) => {
  expect(validateEnv({ ...base, ...override })).toEqual([expect.stringMatching(new RegExp(`^${name}: `))]);
});

test("Google needs both the client ID and the secret", () => {
  expect(validateEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toEqual([
    "GOOGLE_CLIENT_SECRET: required when GOOGLE_CLIENT_ID is set",
  ]);
  expect(validateEnv({ ...base, GOOGLE_CLIENT_SECRET: "secret" })).toEqual([
    "GOOGLE_CLIENT_ID: required when GOOGLE_CLIENT_SECRET is set",
  ]);
});

test("Turnstile needs both the site key and the secret", () => {
  expect(validateEnv({ ...base, TURNSTILE_SECRET_KEY: "secret" })).toEqual([
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY: required when TURNSTILE_SECRET_KEY is set",
  ]);
  expect(validateEnv({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site" })).toEqual([
    "TURNSTILE_SECRET_KEY: required when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set",
  ]);
});

test("production needs Resend and a sender, unless emails go to an outbox", () => {
  const noEmail = { ...production, RESEND_API_KEY: undefined, EMAIL_FROM: undefined };

  expect(validateEnv(noEmail)).toEqual(["RESEND_API_KEY: required in production"]);
  expect(validateEnv({ ...noEmail, RESEND_API_KEY: "re_live" })).toEqual([
    "EMAIL_FROM: required in production when RESEND_API_KEY is set",
  ]);
  // E2E runs a production build on localhost with the outbox.
  expect(
    validateEnv({ ...noEmail, BETTER_AUTH_URL: "http://localhost:3100", EMAIL_OUTBOX_DIR: "/tmp/outbox" }),
  ).toEqual([]);
});

test("catches a DeepSeek key that isn't one", () => {
  expect(validateEnv({ ...base, DEEPSEEK_API_KEY: "sk_test_1" })).toEqual([
    "DEEPSEEK_API_KEY: must start with sk-",
  ]);
});

test("catches an ADMIN_EMAILS entry that isn't an email", () => {
  expect(validateEnv({ ...base, ADMIN_EMAILS: "a@example.com, b@example.com" })).toEqual([]);
  expect(validateEnv({ ...base, ADMIN_EMAILS: "a@example.com; b@example.com" })).toEqual([
    "ADMIN_EMAILS: must be emails separated by commas",
  ]);
});

test("catches a Sentry DSN that isn't a URL", () => {
  expect(validateEnv({ ...base, NEXT_PUBLIC_SENTRY_DSN: "abc123" })).toEqual([
    "NEXT_PUBLIC_SENTRY_DSN: must be an http(s) URL",
  ]);
  expect(validateEnv({ ...base, NEXT_PUBLIC_SENTRY_DSN: "https://key@o1.ingest.sentry.io/2" })).toEqual([]);
});

test("catches a short CRON_SECRET", () => {
  expect(validateEnv({ ...base, CRON_SECRET: "c".repeat(32) })).toEqual([]);
  expect(validateEnv({ ...base, CRON_SECRET: "short" })).toEqual([
    "CRON_SECRET: must be at least 32 characters",
  ]);
});

test("rejects an unknown PAYMENT_PROVIDER", () => {
  expect(validateEnv({ ...base, PAYMENT_PROVIDER: "paypal" })).toEqual([
    expect.stringMatching(/^PAYMENT_PROVIDER: /),
  ]);
});

test("Stripe needs its secret key and webhook secret", () => {
  expect(validateEnv({ ...base, PAYMENT_PROVIDER: "stripe" })).toEqual([
    "STRIPE_SECRET_KEY: required when PAYMENT_PROVIDER is stripe",
    "STRIPE_WEBHOOK_SECRET: required when PAYMENT_PROVIDER is stripe",
  ]);
});

test("catches Stripe values pasted into the wrong variable", () => {
  expect(
    validateEnv({ ...base, ...stripe, STRIPE_SECRET_KEY: "pk_test_1", STRIPE_WEBHOOK_SECRET: "sk_test_1" }),
  ).toEqual([
    "STRIPE_SECRET_KEY: must start with sk_ or rk_",
    "STRIPE_WEBHOOK_SECRET: must start with whsec_",
  ]);
});

test("Waffo needs its merchant ID and private key", () => {
  expect(validateEnv({ ...base, PAYMENT_PROVIDER: "waffo", WAFFO_PRODUCT_ID: "PROD_1" })).toEqual([
    "WAFFO_MERCHANT_ID: required when PAYMENT_PROVIDER is waffo",
    "WAFFO_PRIVATE_KEY: required when PAYMENT_PROVIDER is waffo",
  ]);
});

test("Waffo needs something to sell", () => {
  const nothing = { ...waffo, WAFFO_PRODUCT_ID: undefined };

  expect(validateEnv({ ...base, ...nothing })).toEqual([
    "WAFFO_PRODUCT_ID: set it, or WAFFO_SUBSCRIPTION_PRODUCT_ID and WAFFO_STORE_ID, when PAYMENT_PROVIDER is waffo",
  ]);
  expect(
    validateEnv({ ...base, ...nothing, WAFFO_SUBSCRIPTION_PRODUCT_ID: "PROD_2", WAFFO_STORE_ID: "STO_1" }),
  ).toEqual([]);
});

test("Waffo subscriptions need both the product and the store", () => {
  expect(validateEnv({ ...base, ...waffo, WAFFO_SUBSCRIPTION_PRODUCT_ID: "PROD_2" })).toEqual([
    "WAFFO_STORE_ID: required when WAFFO_SUBSCRIPTION_PRODUCT_ID is set",
  ]);
  expect(validateEnv({ ...base, ...waffo, WAFFO_STORE_ID: "STO_1" })).toEqual([
    "WAFFO_SUBSCRIPTION_PRODUCT_ID: required when WAFFO_STORE_ID is set",
  ]);
});

test("Waffo yearly plans need the monthly subscription setup", () => {
  const monthly = { WAFFO_SUBSCRIPTION_PRODUCT_ID: "PROD_2", WAFFO_STORE_ID: "STO_1" };
  expect(validateEnv({ ...base, ...waffo, ...monthly, WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID: "PROD_3" })).toEqual([]);
  expect(validateEnv({ ...base, ...waffo, WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID: "PROD_3" })).toEqual([
    "WAFFO_SUBSCRIPTION_PRODUCT_ID: required when WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID is set",
  ]);
});

test("catches a malformed Waffo merchant ID, private key or environment", () => {
  expect(
    validateEnv({
      ...base,
      ...waffo,
      WAFFO_MERCHANT_ID: "1234",
      WAFFO_PRIVATE_KEY: "-----BEGIN PUBLIC KEY-----",
      WAFFO_ENVIRONMENT: "staging",
    }),
  ).toEqual([
    "WAFFO_MERCHANT_ID: must start with MER_",
    "WAFFO_PRIVATE_KEY: must be a PEM private key",
    expect.stringMatching(/^WAFFO_ENVIRONMENT: /),
  ]);
});

const images = {
  DASHSCOPE_API_KEY: "sk-1",
  STORAGE_ENDPOINT: "http://localhost:9000",
  STORAGE_BUCKET: "starter",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_FORCE_PATH_STYLE: "true",
};

test("accepts image generation with storage", () => {
  expect(validateEnv({ ...base, ...images })).toEqual([]);
});

test("image generation needs storage", () => {
  expect(validateEnv({ ...base, DASHSCOPE_API_KEY: "sk-1" })).toEqual([
    "STORAGE_BUCKET: required when DASHSCOPE_API_KEY is set",
    "STORAGE_ACCESS_KEY_ID: required when DASHSCOPE_API_KEY is set",
    "STORAGE_SECRET_ACCESS_KEY: required when DASHSCOPE_API_KEY is set",
  ]);
});

test("accepts either video provider with its key and storage", () => {
  const storage = { ...images, DASHSCOPE_API_KEY: "" };
  expect(validateEnv({ ...base, ...storage, VIDEO_PROVIDER: "fal", FAL_KEY: "k" })).toEqual([]);
  expect(validateEnv({ ...base, ...storage, VIDEO_PROVIDER: "seeapi", SEEAPI_API_KEY: "k" })).toEqual([]);
  expect(validateEnv({ ...base, ...images, VIDEO_PROVIDER: "dashscope" })).toEqual([]);
});

test("the video provider needs its key and storage", () => {
  expect(validateEnv({ ...base, VIDEO_PROVIDER: "seeapi" })).toEqual([
    "SEEAPI_API_KEY: required when VIDEO_PROVIDER is seeapi",
    "STORAGE_BUCKET: required when VIDEO_PROVIDER is set",
    "STORAGE_ACCESS_KEY_ID: required when VIDEO_PROVIDER is set",
    "STORAGE_SECRET_ACCESS_KEY: required when VIDEO_PROVIDER is set",
  ]);
  expect(validateEnv({ ...base, ...images, VIDEO_PROVIDER: "fal" })).toEqual([
    "FAL_KEY: required when VIDEO_PROVIDER is fal",
  ]);
  expect(validateEnv({ ...base, ...images, DASHSCOPE_API_KEY: "", VIDEO_PROVIDER: "dashscope" })).toEqual([
    "DASHSCOPE_API_KEY: required when VIDEO_PROVIDER is dashscope",
  ]);
  expect(validateEnv({ ...base, ...images, VIDEO_PROVIDER: "replicate" })).toEqual([
    "VIDEO_PROVIDER: must be fal, seeapi or dashscope, or empty",
  ]);
});

test("image moderation is seeapi or off, and needs SeeAPI's key", () => {
  expect(validateEnv({ ...base, IMAGE_MODERATION: "seeapi", SEEAPI_API_KEY: "k" })).toEqual([]);
  expect(validateEnv({ ...base, IMAGE_MODERATION: "seeapi" })).toEqual([
    "SEEAPI_API_KEY: required when IMAGE_MODERATION is seeapi",
  ]);
  expect(validateEnv({ ...base, IMAGE_MODERATION: "openai" })).toEqual(["IMAGE_MODERATION: must be seeapi, or empty"]);
});

test("storage needs the bucket and both keys together", () => {
  expect(validateEnv({ ...base, STORAGE_BUCKET: "starter" })).toEqual([
    "STORAGE_ACCESS_KEY_ID: required when STORAGE_BUCKET is set",
    "STORAGE_SECRET_ACCESS_KEY: required when STORAGE_BUCKET is set",
  ]);
});

test("catches a malformed Bailian or storage URL", () => {
  expect(
    validateEnv({
      ...base,
      ...images,
      DASHSCOPE_BASE_URL: "dashscope.aliyuncs.com",
      STORAGE_ENDPOINT: "localhost:9000",
      STORAGE_FORCE_PATH_STYLE: "yes",
    }),
  ).toEqual([
    "DASHSCOPE_BASE_URL: must be an http(s) URL",
    "STORAGE_ENDPOINT: must be an http(s) URL",
    "STORAGE_FORCE_PATH_STYLE: must be true or false, or empty",
  ]);
});

test("throws one error that lists every problem and no values", () => {
  const secret = "too-short-secret";

  expect(() => assertValidEnv({ ...base, BETTER_AUTH_SECRET: secret, DATABASE_URL: undefined })).toThrow(
    /Invalid environment[\s\S]*\n- DATABASE_URL: .*\n- BETTER_AUTH_SECRET: /,
  );
  expect(() => assertValidEnv({ ...base, BETTER_AUTH_SECRET: secret })).not.toThrow(new RegExp(secret));
  expect(() => assertValidEnv(base)).not.toThrow();
});

test("checks INDEXNOW_KEY is 8-128 letters, digits or hyphens", () => {
  expect(validateEnv({ ...base, INDEXNOW_KEY: "0123456789abcdef-XYZ" })).toEqual([]);
  for (const key of ["short", "has spaces in it", "k".repeat(129)]) {
    expect(validateEnv({ ...base, INDEXNOW_KEY: key })).toEqual([
      "INDEXNOW_KEY: must be 8-128 letters, digits or hyphens",
    ]);
  }
});

test("checks CLIENT_IP_HEADER is a header name", () => {
  expect(validateEnv({ ...base, CLIENT_IP_HEADER: "cf-connecting-ip" })).toEqual([]);
  expect(validateEnv({ ...base, CLIENT_IP_HEADER: "cf-connecting-ip, x-forwarded-for" })).toEqual([
    "CLIENT_IP_HEADER: must be one header name",
  ]);
});

test("a public production server must use https", () => {
  expect(validateEnv({ ...production, BETTER_AUTH_URL: "http://app.example.com" })).toEqual([
    "BETTER_AUTH_URL: must be https:// in production",
  ]);
});

test("a public production server refuses test-only switches", () => {
  expect(validateEnv({ ...production, AI_MOCK: "1", EMAIL_OUTBOX_DIR: "/tmp/outbox" })).toEqual([
    "AI_MOCK: test-only, not allowed in production",
    "EMAIL_OUTBOX_DIR: test-only, not allowed in production",
  ]);
});

// E2E runs a production build on localhost with the test switches on.
test("a production build on localhost may use http and the test switches", () => {
  const e2e = { ...base, NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3100" };
  expect(validateEnv({ ...e2e, AI_MOCK: "1", EMAIL_OUTBOX_DIR: "/tmp/outbox" })).toEqual([]);
  expect(validateEnv({ ...e2e, BETTER_AUTH_URL: "http://127.0.0.1:3100", EMAIL_OUTBOX_DIR: "/tmp/outbox" })).toEqual([]);
});

test("production needs CRON_SECRET with images or videos, so abandoned ones get refunded", () => {
  const storage = { STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "k", STORAGE_SECRET_ACCESS_KEY: "s" };
  expect(validateEnv({ ...production, ...storage, DASHSCOPE_API_KEY: "sk-1" })).toEqual([
    "CRON_SECRET: required in production when DASHSCOPE_API_KEY is set",
  ]);
  expect(validateEnv({ ...production, ...storage, VIDEO_PROVIDER: "fal", FAL_KEY: "k" })).toEqual([
    "CRON_SECRET: required in production when VIDEO_PROVIDER is set",
  ]);
  expect(
    validateEnv({ ...production, ...storage, DASHSCOPE_API_KEY: "sk-1", CRON_SECRET: "c".repeat(32) }),
  ).toEqual([]);
  // Locally the sweep is optional.
  expect(validateEnv({ ...base, ...storage, DASHSCOPE_API_KEY: "sk-1" })).toEqual([]);
});

test("production needs CRON_SECRET with yearly plans, so subscribers get every month", () => {
  const cron = { CRON_SECRET: "c".repeat(32) };
  expect(validateEnv({ ...production, ...stripe })).toEqual([
    "CRON_SECRET: required in production when yearly plans are on sale",
  ]);
  expect(validateEnv({ ...production, ...stripe, ...cron })).toEqual([]);

  const monthly = { WAFFO_SUBSCRIPTION_PRODUCT_ID: "PROD_2", WAFFO_STORE_ID: "STO_1" };
  expect(validateEnv({ ...production, ...waffo, ...monthly })).toEqual([]);
  expect(validateEnv({ ...production, ...waffo, ...monthly, WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID: "PROD_3" })).toEqual([
    "CRON_SECRET: required in production when yearly plans are on sale",
  ]);
  // Locally the sweep is optional.
  expect(validateEnv({ ...base, ...stripe })).toEqual([]);
});

test("checks the log level and format", () => {
  expect(validateEnv({ ...base, LOG_LEVEL: "debug", LOG_FORMAT: "json" })).toEqual([]);
  expect(validateEnv({ ...base, LOG_LEVEL: "verbose", LOG_FORMAT: "text" })).toEqual([
    "LOG_LEVEL: must be debug, info, warn or error, or empty",
    "LOG_FORMAT: must be json or pretty, or empty",
  ]);
});

test("turns Vercel Web Analytics on with 1 only", () => {
  expect(validateEnv({ ...base, NEXT_PUBLIC_VERCEL_ANALYTICS: "1" })).toEqual([]);
  expect(validateEnv({ ...base, NEXT_PUBLIC_VERCEL_ANALYTICS: "true" })).toEqual([
    "NEXT_PUBLIC_VERCEL_ANALYTICS: must be 1, or empty",
  ]);
});

test("turns Vercel Speed Insights on with 1 only", () => {
  expect(validateEnv({ ...base, NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS: "1" })).toEqual([]);
  expect(validateEnv({ ...base, NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS: "true" })).toEqual([
    "NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS: must be 1, or empty",
  ]);
});

test("accepts every payment and video provider the code registers", () => {
  for (const id of PROVIDER_IDS) {
    expect(validateEnv({ ...base, PAYMENT_PROVIDER: id }).filter((p) => p.startsWith("PAYMENT_PROVIDER:"))).toEqual([]);
  }
  for (const id of VIDEO_PROVIDER_IDS) {
    expect(validateEnv({ ...base, VIDEO_PROVIDER: id }).filter((p) => p.startsWith("VIDEO_PROVIDER:"))).toEqual([]);
  }
});

test("requireEnv returns a set variable and names a missing one", () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_1");
  expect(requireEnv("STRIPE_SECRET_KEY")).toBe("sk_test_1");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  expect(() => requireEnv("STRIPE_SECRET_KEY")).toThrow("STRIPE_SECRET_KEY is not set");
  vi.unstubAllEnvs();
});


test("Waffo prompt screening requires both signing credentials", () => {
  expect(validateEnv({ ...base, PROMPT_MODERATION: "waffo" })).toEqual([
    "WAFFO_MERCHANT_ID: required when PROMPT_MODERATION is waffo",
    "WAFFO_PRIVATE_KEY: required when PROMPT_MODERATION is waffo",
  ]);
  expect(validateEnv({ ...base, ...waffo, PROMPT_MODERATION: "waffo" })).toEqual([]);
  expect(validateEnv({ ...base, PROMPT_MODERATION: "invalid" })).toContain("PROMPT_MODERATION: must be waffo, or empty");
});
