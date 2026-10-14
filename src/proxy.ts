import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

// Paths in the (dashboard) group. Add new signed-in pages here.
const PROTECTED = ["/dashboard", "/chat", "/images", "/videos", "/profile", "/billing", "/api-keys", "/notifications", "/feedback", "/admin"];
const protectedPath = new RegExp(
  `^/(${routing.locales.join("|")})(${PROTECTED.join("|")})(/|$)`,
);

export function proxy(request: NextRequest) {
  // Optimistic check: only looks for the session cookie. The (dashboard) layout
  // verifies the session itself.
  const match = request.nextUrl.pathname.match(protectedPath);
  if (match && !getSessionCookie(request)) {
    // Sign-in returns here afterwards.
    const signIn = new URL(`/${match[1]}/sign-in`, request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }
  return intl(request);
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
