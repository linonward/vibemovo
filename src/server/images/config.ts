// Credits spent per generated image. Refunded if generation fails.
export const imageCost = 1;

// Bailian finishes an image within a minute, so one still pending after this
// was never submitted (a crash) or nobody polled for it.
export const IMAGE_STALE_AFTER_MS = 15 * 60_000;

// Bailian forgets a task after 24 hours.
export const IMAGE_GIVE_UP_AFTER_MS = 24 * 60 * 60_000;

// Pending images the sweep asks Bailian about per run.
export const IMAGE_SWEEP_BATCH = 20;

// Newest images under the form on /images; the rest are on /images/library.
export const RECENT_IMAGES = 10;

// Images per page of /images/library.
export const IMAGES_PAGE_SIZE = 24;

export const IMAGE_ASPECTS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;

export type ImageAspect = (typeof IMAGE_ASPECTS)[number];

// Bailian's recommended sizes for wan2.6-t2i.
export const IMAGE_SIZES: Record<ImageAspect, string> = {
  "1:1": "1280*1280",
  "3:4": "1104*1472",
  "4:3": "1472*1104",
  "9:16": "960*1696",
  "16:9": "1696*960",
};

// Bailian accepts up to 2,100 characters.
export const MAX_PROMPT_LENGTH = 2000;
