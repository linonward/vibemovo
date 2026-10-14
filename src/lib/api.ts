// The JSON the API routes answer with. Routes in src/app/api write it and
// components read it, so a renamed field or error code fails the typecheck
// on both sides instead of at runtime.

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_ORIGIN"
  | "RATE_LIMITED"
  | "API_KEY_NOT_ALLOWED"
  | "INVALID_API_KEY"
  | "NOT_FOUND"
  | "INVALID_REQUEST"
  | "INSUFFICIENT_CREDITS"
  // Chat
  | "INVALID_CHAT"
  | "CHAT_NOT_FOUND"
  | "CHAT_DISABLED"
  | "CHAT_FAILED"
  // Images and videos
  | "CONTENT_BLOCKED"
  | "INVALID_IMAGE_SIZE"
  | "MODERATION_UNAVAILABLE"
  | "IMAGES_DISABLED"
  | "VIDEOS_DISABLED"
  | "IMAGE_NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "GENERATION_FAILED"
  | "REFRESH_FAILED"
  // Payments
  | "UNKNOWN_PACK"
  | "UNKNOWN_PLAN"
  | "ALREADY_SUBSCRIBED"
  | "CHECKOUT_PENDING"
  | "NO_SUBSCRIPTION"
  | "PAYMENTS_DISABLED"
  | "CHECKOUT_FAILED"
  | "PORTAL_FAILED"
  | "UNKNOWN_PROVIDER"
  | "INVALID_SIGNATURE"
  | "UNKNOWN_ORDER"
  // Feedback
  | "FEEDBACK_STORAGE_DISABLED"
  | "FEEDBACK_FAILED"
  // Admin
  | "UNKNOWN_USER";

export type ApiErrorBody = { error: ApiErrorCode };

export type GenerationStatus = "pending" | "succeeded" | "failed";

export type GeneratedImage = {
  id: string;
  prompt: string;
  aspect: string;
  status: GenerationStatus;
  createdAt: Date;
  // Signed and short-lived. Null unless the image is stored.
  url: string | null;
};

export type GeneratedVideo = {
  id: string;
  prompt: string;
  duration: number;
  resolution: string;
  // Credits spent, refunded if the video failed.
  credits: number;
  status: GenerationStatus;
  createdAt: Date;
  // Signed and short-lived. url is null until the video is stored.
  url: string | null;
  imageUrl: string | null;
};

// An in-app notification. The page writes the text from `type` and `data`.
export type AppNotification = { id: string; readAt: Date | null; createdAt: Date } & (
  | { type: "image_succeeded"; data: { imageId: string; prompt: string } }
  | { type: "image_failed"; data: { imageId: string; prompt: string; credits: number } }
  | { type: "video_succeeded"; data: { videoId: string; prompt: string } }
  | { type: "video_failed"; data: { videoId: string; prompt: string; credits: number } }
  | { type: "order_paid"; data: { orderId: string; credits: number } }
  | { type: "subscription_paid"; data: { planId: string; credits: number } }
  | { type: "subscription_past_due"; data: { planId: string } }
  | { type: "subscription_ended"; data: { planId: string } }
  | { type: "credits_added"; data: { credits: number } }
  | { type: "broadcast"; data: { broadcastId: string; title: string; body: string } }
);

export type ImageResponse = { image: GeneratedImage };
export type VideoResponse = { video: GeneratedVideo };
export type BalanceResponse = { balance: number };
// The newest notifications and how many are unread.
export type NotificationsResponse = { notifications: AppNotification[]; unread: number };
export type UnreadResponse = { unread: number };
export type FeedbackResponse = { feedback: { id: string } };
export type BroadcastResponse = { broadcast: { id: string; recipients: number } };
// Where to send the browser: a checkout or the provider's portal.
export type RedirectResponse = { url: string };

// JSON turns each Date into an ISO string.
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

// What a component reads back from a route answering T: every field may be
// missing (an error, or a body that isn't ours), dates are strings.
export type ApiBody<T> = Partial<{ [K in keyof T]: Serialized<T[K]> } & ApiErrorBody>;

export function apiError(code: ApiErrorCode, status: number): Response {
  return Response.json({ error: code } satisfies ApiErrorBody, { status });
}
