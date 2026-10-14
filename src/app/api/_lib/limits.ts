import type { RouteLimit } from "./with-session";

// Per-user limits on routes that cost a provider call, a signed URL or a
// database write per hit but no credits. Each allows several times what the
// app's own pages send.
export const LIMITS = {
  feedback: { name: "feedback", max: 5, windowMs: 60_000 },
  // A page polls each pending image every 3 s and each video every 5 s.
  imagePoll: { name: "image-poll", max: 240, windowMs: 60_000 },
  videoPoll: { name: "video-poll", max: 240, windowMs: 60_000 },
  download: { name: "download", max: 60, windowMs: 60_000 },
  // The bell polls every 60 s and on open; reads come one click at a time.
  notifications: { name: "notifications", max: 60, windowMs: 60_000 },
  notificationsRead: { name: "notifications-read", max: 120, windowMs: 60_000 },
} satisfies Record<string, RouteLimit>;
