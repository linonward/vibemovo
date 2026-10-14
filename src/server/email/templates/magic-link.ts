import { projectConfig } from "project.config";
import type { Email } from "@/server/email/client";
import { escapeHtml } from "./escape";

export function magicLinkEmail(to: string, url: string): Email {
  const action = `Sign in to ${projectConfig.name}`;
  return {
    to,
    subject: action,
    text: `${action}:\n\n${url}\n\nThe link expires in 5 minutes. If you didn't ask for it, ignore this email.`,
    html: `<p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p><p>The link expires in 5 minutes. If you didn't ask for it, ignore this email.</p>`,
  };
}
