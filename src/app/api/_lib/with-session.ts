import { apiError } from "@/lib/api";
import { API_KEY_HEADER } from "@/server/auth/api-key-config";
import { getSession, type Session } from "@/server/auth/session";
import { hitLimit } from "@/server/ratelimit";

export type RouteLimit = { name: string; max: number; windowMs: number };

type Handler<P> = (request: Request, context: { session: Session; params: P }) => Promise<Response>;

// Methods a cross-site form or fetch could use to change data.
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// Wraps a signed-in API route. In order:
// - A request with an API key (API_KEY_HEADER) gets 403 API_KEY_NOT_ALLOWED
//   unless the route sets `apiKey`, then 401 INVALID_API_KEY for a key the
//   auth plugin refuses, or 429 RATE_LIMITED past the key's own limit. It
//   skips the Origin check: no cookie rides along, so no site can forge it.
// - 401 without a session.
// - 403 FORBIDDEN_ORIGIN when a cookie request that changes data doesn't
//   come from this app's own pages (Better Auth checks its own routes, and
//   SameSite cookies alone don't stop a sibling subdomain).
// - 429 RATE_LIMITED with Retry-After past `limit` hits per user.
// Then runs the handler with the session and the route's params.
export function withSession<P extends object = Record<string, never>>(
  handler: Handler<P>,
  { limit, apiKey = false }: { limit?: RouteLimit; apiKey?: boolean } = {},
) {
  return async (request: Request, context?: { params: Promise<P> }): Promise<Response> => {
    const viaKey = request.headers.has(API_KEY_HEADER);
    if (viaKey && !apiKey) return apiError("API_KEY_NOT_ALLOWED", 403);

    let session: Session | null;
    try {
      session = await getSession(request.headers);
    } catch (error) {
      if (!viaKey) throw error;
      const refused = error as { status?: string; body?: { details?: { tryAgainIn?: number } } };
      if (refused.status === "TOO_MANY_REQUESTS") {
        return rateLimited(refused.body?.details?.tryAgainIn ?? 60_000);
      }
      return apiError("INVALID_API_KEY", 401);
    }
    if (!session) return apiError("UNAUTHORIZED", 401);

    if (!viaKey && !SAFE_METHODS.includes(request.method) && !sameOrigin(request)) {
      return apiError("FORBIDDEN_ORIGIN", 403);
    }

    if (limit) {
      const hit = await hitLimit(`api:${limit.name}:${session.user.id}`, limit);
      if (!hit.allowed) return rateLimited(hit.retryAfterMs);
    }

    return handler(request, { session, params: (await context?.params) as P });
  };
}

function rateLimited(retryAfterMs: number): Response {
  const response = apiError("RATE_LIMITED", 429);
  response.headers.set("retry-after", String(Math.ceil(retryAfterMs / 1000)));
  return response;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === URL.parse(process.env.BETTER_AUTH_URL ?? "")?.origin;
}
