import type { VideoProviderId } from "@/server/ai/video";
import type { ImageLimits } from "./image-size";

export const VIDEO_DURATIONS = [5, 10] as const;

export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

// What each provider accepts as a start image. A photo outside these limits
// is turned away before it spends credits, instead of failing at the
// provider. SeeAPI: 301-5999 pixels a side, ratio between 0.4 and 2.5
// (seeapi.com/docs/seedance-2/image-to-video). Bailian Wan: 240-8000
// pixels, 1:8 to 8:1. fal doesn't publish Kling's; these are Kling's own
// (at least 300 pixels, 1:2.5 to 2.5:1), with Bailian's upper bound.
export const VIDEO_IMAGE_LIMITS: Record<VideoProviderId, ImageLimits> = {
  fal: { minSide: 300, maxSide: 8000, maxRatio: 2.5 },
  seeapi: { minSide: 301, maxSide: 5999, maxRatio: 2.5 },
  dashscope: { minSide: 240, maxSide: 8000, maxRatio: 8 },
};

// Credits spent per second of video, by provider and resolution, lowest
// first. Refunded if generation fails. src/server/payment/margins.test.ts
// checks that every pack and plan sells each one for at least 1.5 times
// VIDEO_COST_PER_SECOND.
export const VIDEO_RESOLUTIONS: Record<VideoProviderId, Record<string, number>> = {
  fal: { "1080p": 4 },
  seeapi: { "480p": 4, "720p": 8, "1080p": 20 },
  dashscope: { "720p": 5, "1080p": 8 },
};

// What each provider charges per second of video, in dollars. Update it
// when a provider changes its prices.
export const VIDEO_COST_PER_SECOND: Record<VideoProviderId, Record<string, number>> = {
  // Kling 2.6 Pro without audio, 1080p only.
  fal: { "1080p": 0.07 },
  // Seedance 2.0.
  seeapi: { "480p": 0.075, "720p": 0.15, "1080p": 0.37 },
  // Bailian Wan 2.7 with audio, at resellers' prices; check the Bailian console.
  dashscope: { "720p": 0.1, "1080p": 0.15 },
};

// Null when the provider has no such resolution.
export function videoCost(provider: VideoProviderId, resolution: string, duration: VideoDuration) {
  const perSecond = Object.hasOwn(VIDEO_RESOLUTIONS[provider], resolution)
    ? VIDEO_RESOLUTIONS[provider][resolution]
    : null;
  return perSecond === null ? null : perSecond * duration;
}

// The rap duo (/videos/rap): Wan 3.0 reference-to-video on Bailian, 720p
// only, about $0.10 a second (resellers' price; check the Bailian console).
export const RAP_DURATION = 15;
export const RAP_RESOLUTION = "720p";
export const RAP_RATIO = "16:9";
export const RAP_CREDITS = 5 * RAP_DURATION;
// Both photos travel in one request body, under Vercel's 4.5 MB cap.
export const RAP_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const RAP_MAX_NAME_LENGTH = 30;

// The zombie couple (/videos/zombie): two photos on the rap duo's model,
// length, size and photo limits, at the same price. Keep RAP_DURATION:
// expireUploads finds a two-photo video's second photo by it.
export const ZOMBIE_CREDITS = RAP_CREDITS;
// What the video list shows in place of a prompt.
export const ZOMBIE_TITLE = "Zombie couple";

// Each rap duo photo, as Bailian Wan 3.0 accepts it: at least 240 pixels a
// side ("resolution must be at least 240x240"); the rest as for Wan 2.7.
export const RAP_IMAGE_LIMITS: ImageLimits = VIDEO_IMAGE_LIMITS.dashscope;

// Videos per page of /videos/library.
export const VIDEOS_PAGE_SIZE = 24;

// Kling accepts up to 2,500 characters.
export const MAX_PROMPT_LENGTH = 2000;

// The start image travels in the request body, and Vercel caps bodies at 4.5 MB.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// The request that submits a video finishes within minutes, so one still
// unsubmitted after this was abandoned by a crash. Submitted videos older
// than this get collected even if nobody has the page open.
export const VIDEO_STALE_AFTER_MS = 15 * 60_000;

// Providers finish within minutes; a job still pending after this is lost.
export const VIDEO_GIVE_UP_AFTER_MS = 24 * 60 * 60_000;

// Uploaded photos (start images, rap duo photos) are deleted this long after
// upload. Providers fetch them at submission. The privacy policy states it.
export const UPLOAD_RETENTION_MS = 24 * 60 * 60_000;

// Videos whose uploads one sweep deletes.
export const UPLOAD_EXPIRY_BATCH = 100;

// Pending videos the sweep asks providers about per run.
export const VIDEO_SWEEP_BATCH = 20;
