import { after } from "next/server";
import { apiError } from "@/lib/api";
import { log } from "@/server/log";
import {
  handleWebhook,
  UnknownOrderError,
  UnknownProviderError,
  WebhookSignatureError,
} from "@/server/payment/webhook";

// Payment webhooks: /api/webhooks/payment/stripe and /api/webhooks/payment/waffo.
// Any non-2xx response makes the provider retry.
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/webhooks/payment/[provider]">,
) {
  const { provider } = await ctx.params;
  // Signatures cover the exact bytes, so read the body as text.
  const payload = await request.text();

  try {
    // Emails go out after the response, so the provider never waits on them.
    await handleWebhook(provider, payload, request.headers, { defer: (task) => after(task) });
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof UnknownProviderError) {
      return apiError("UNKNOWN_PROVIDER", 404);
    }
    if (error instanceof WebhookSignatureError) {
      return apiError("INVALID_SIGNATURE", 400);
    }
    // The provider retries, so a fix can still deliver the credits.
    if (error instanceof UnknownOrderError) {
      log.error("payment.unknown_order", { provider, error });
      return apiError("UNKNOWN_ORDER", 409);
    }
    throw error;
  }
}
