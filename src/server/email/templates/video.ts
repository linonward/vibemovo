import { projectConfig } from "project.config";
import type { Email } from "@/server/email/client";
import { actionEmail } from "./action";

// Prompts can be long; the email quotes enough to recognize the video.
const MAX_PROMPT = 100;

function quote(prompt: string) {
  const short = prompt.length > MAX_PROMPT ? `${prompt.slice(0, MAX_PROMPT - 1)}…` : prompt;
  return `“${short}”`;
}

// Sent only when the video finished while the user wasn't on the page.
export function videoReadyEmail(to: string, prompt: string, videoUrl: string): Email {
  const { name } = projectConfig;
  return actionEmail(
    to,
    `Your ${name} video is ready`,
    `Your video ${quote(prompt)} is ready to watch and download.`,
    "Watch your video",
    videoUrl,
  );
}

export function videoFailedEmail(to: string, prompt: string, credits: number, videosUrl: string): Email {
  const { name } = projectConfig;
  return actionEmail(
    to,
    `Your ${name} video couldn't be made`,
    `We couldn't make your video ${quote(prompt)}. ${credits} ${credits === 1 ? "credit was" : "credits were"} refunded to your account.`,
    "Try again",
    videosUrl,
  );
}
