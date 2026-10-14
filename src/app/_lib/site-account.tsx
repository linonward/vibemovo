import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AccountLink } from "@/components/layout/site-header";

// The site header's account button. Only it reads the request, so the
// pages around it stay prerendered. Most visitors to public pages are
// signed out, so it shows Sign in until the cookie check resolves.
export function SiteAccount() {
  return (
    <Suspense fallback={<AccountLink signedIn={false} />}>
      <Account />
    </Suspense>
  );
}

// Checks the cookie only, as src/proxy.ts does; the dashboard verifies the
// session. A stale cookie shows Dashboard, which then leads to sign-in.
async function Account() {
  return <AccountLink signedIn={getSessionCookie(await headers()) !== null} />;
}
