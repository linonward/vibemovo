import { log } from "@/server/log";

type Event = "checkout_started" | "signup_completed" | "generation_started" | "generation_succeeded" | "generation_failed" | "payment_succeeded";
type Properties = {
  kind?: string;
  credits?: number;
  provider?: string;
  product_id?: string;
  payment_kind?: "pack" | "subscription";
  catalogue_amount_minor?: number;
  currency?: string;
  interval?: string;
};

// Best effort, awaited so serverless requests keep the send alive. No content,
// email, payment credentials, or raw error messages belong in analytics.
export async function capture(event: Event, userId: string, properties: Properties = {}): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return;
  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: `vibemovo:${userId}`,
        timestamp: new Date().toISOString(),
        properties: { ...properties, app: "vibemovo", $process_person_profile: true, $geoip_disable: true },
      }),
    });
    if (!response.ok) log.warn("analytics.capture_failed", { event, status: response.status });
  } catch {
    log.warn("analytics.capture_failed", { event });
  }
}
