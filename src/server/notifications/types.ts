export const NOTIFICATION_TYPES = [
  "image_succeeded",
  "image_failed",
  "video_succeeded",
  "video_failed",
  "order_paid",
  "subscription_paid",
  "subscription_past_due",
  "subscription_ended",
  "credits_added",
  "broadcast",
] as const;

// What happened, by type. Failed generations name the credits refunded;
// payments and admin grants name the credits added. A broadcast carries the
// admin's own text, which isn't translated.
export type NotificationContent =
  | { type: "image_succeeded"; data: { imageId: string; prompt: string } }
  | { type: "image_failed"; data: { imageId: string; prompt: string; credits: number } }
  | { type: "video_succeeded"; data: { videoId: string; prompt: string } }
  | { type: "video_failed"; data: { videoId: string; prompt: string; credits: number } }
  | { type: "order_paid"; data: { orderId: string; credits: number } }
  | { type: "subscription_paid"; data: { planId: string; credits: number } }
  | { type: "subscription_past_due"; data: { planId: string } }
  | { type: "subscription_ended"; data: { planId: string } }
  | { type: "credits_added"; data: { credits: number } }
  | { type: "broadcast"; data: { broadcastId: string; title: string; body: string } };
