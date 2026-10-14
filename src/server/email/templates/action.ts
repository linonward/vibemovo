import type { Email } from "@/server/email/client";
import { escapeHtml } from "./escape";

// A one-paragraph email with one link to act on.
export function actionEmail(to: string, subject: string, body: string, action: string, url: string): Email {
  return {
    to,
    subject,
    text: `${body}\n\n${action}: ${url}`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p>`,
  };
}
