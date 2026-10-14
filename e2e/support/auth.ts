import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { BASE_URL, EMAIL_OUTBOX_DIR } from "../../playwright.config";

function randomIp() {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

export function uniqueEmail() {
  return `user-${randomUUID()}@example.com`;
}

const outboxFile = (email: string) => join(EMAIL_OUTBOX_DIR, `${email}.json`);

// The newest email sent to this address, once its subject matches. The
// outbox keeps one file per address, so a later email replaces an earlier one.
export async function readEmail(email: string, subject: RegExp): Promise<{ subject: string; text: string }> {
  const file = outboxFile(email);
  const read = () => readFile(file, "utf8").then(JSON.parse, () => ({ subject: "", text: "" }));
  await expect.poll(async () => (await read()).subject).toMatch(subject);
  return read();
}

export async function readMagicLink(email: string) {
  const { text } = await readEmail(email, /^Sign in to /);
  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`No link in email: ${text}`);
  return url;
}

export async function getSession(page: Page) {
  return (await page.request.get("/api/auth/get-session")).json();
}

// Signs in through the API instead of the sign-in form, for tests that
// need a signed-in user but aren't about signing in.
export async function signIn(page: Page, email = uniqueEmail()) {
  // Better Auth rate-limits magic-link requests and verifications per client
  // IP (5 per minute). Every test is a different user, so give each one its
  // own IP for both the API call and the browser navigation.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  // Fixed emails (the admin) reuse an outbox file; drop the old link first.
  await rm(outboxFile(email), { force: true });
  const response = await page.request.post("/api/auth/sign-in/magic-link", {
    data: { email, callbackURL: "/en/dashboard" },
    // Once the browser holds cookies (e.g. NEXT_LOCALE), Better Auth's CSRF
    // check requires an Origin header, as a real browser would send.
    headers: { origin: BASE_URL },
  });
  expect(response.status(), await response.text()).toBe(200);
  await page.goto(await readMagicLink(email));
  expect((await getSession(page))?.user.email).toBe(email);
  return email;
}
