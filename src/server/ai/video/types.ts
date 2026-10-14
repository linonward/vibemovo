export const VIDEO_PROVIDER_IDS = ["fal", "seeapi", "dashscope"] as const;
export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number];

export class VideoGenerationError extends Error {
  constructor(
    message: string,
    // The provider's error type, such as fal's "content_policy_violation".
    readonly code?: string,
  ) {
    super(message);
    this.name = "VideoGenerationError";
  }
}

export type VideoJob = {
  prompt: string;
  // Seconds.
  duration: number;
  // One of the provider's resolutions in VIDEO_RESOLUTIONS.
  resolution: string;
  // The start image as bytes, and as a signed URL for providers that fetch it.
  image: { bytes: Uint8Array; mime: string; url: string };
  // Stable per video, so a retried submission doesn't start a second job.
  idempotencyKey: string;
};

// A video built from reference images: Bailian's Wan 3.0, which also
// sings or speaks the prompt's quoted lines. The prompt calls the images
// 图1, 图2, ... in this order.
export type ReferenceVideoJob = {
  prompt: string;
  images: { bytes: Uint8Array; mime: string; url: string }[];
  // Seconds.
  duration: number;
  resolution: string;
  ratio: string;
};

export type VideoResult =
  | { status: "pending" }
  | { status: "succeeded"; url: string }
  | { status: "failed"; code?: string; error: string };

export interface VideoProvider {
  id: VideoProviderId;
  configured(): boolean;
  // Queues one video and returns the provider's request ID.
  submit(job: VideoJob): Promise<string>;
  // Checks a queued video. Throws if the provider can't answer, so the
  // caller can retry later.
  result(requestId: string): Promise<VideoResult>;
}
