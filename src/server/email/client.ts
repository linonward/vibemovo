import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectConfig } from "project.config";
import { Resend } from "resend";
import { log } from "@/server/log";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Resend's test sender: it only delivers to your own Resend account's address.
const DEFAULT_FROM = `${projectConfig.name} <onboarding@resend.dev>`;

// Sends through Resend when RESEND_API_KEY is set. Otherwise logs the email
// and, if EMAIL_OUTBOX_DIR is set, saves it as <to>.json for tests to read.
// Production refuses to run without a key unless an outbox is configured.
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return sendWithResend(apiKey, email);

  const outbox = process.env.EMAIL_OUTBOX_DIR;
  if (process.env.NODE_ENV === "production" && !outbox) {
    throw new Error("RESEND_API_KEY is not set");
  }

  log.info("email.not_sent", { to: email.to, subject: email.subject, text: email.text });
  if (outbox) {
    await mkdir(outbox, { recursive: true });
    await writeFile(join(outbox, `${email.to}.json`), JSON.stringify(email));
  }
}

async function sendWithResend(apiKey: string, email: Email) {
  const { error } = await new Resend(apiKey).emails.send({
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    ...email,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
