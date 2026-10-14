import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { userBalance, userSubscription } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { CreditsProvider } from "@/components/dashboard/credits";
import { MobileBar } from "@/components/dashboard/mobile-trigger";
import { ShellSkeleton } from "@/components/dashboard/shell-skeleton";
import { FeedbackLink } from "@/components/feedback/feedback-link";
import { NotificationsProvider } from "@/components/notifications/notifications";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import { isAdmin } from "@/server/admin/access";
import { unreadCount } from "@/server/notifications";

// Signed-out crawlers are redirected to sign-in; noindex keeps these pages
// out of search results even if that redirect fails.
export const metadata: Metadata = { robots: { index: false } };

// Signed-in area with a sidebar shell. src/proxy.ts redirects early on a
// missing cookie; this layout verifies the session itself, behind Suspense
// so the session read doesn't block the static shell. Until then it shows
// the shell in outline.
export default function DashboardLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) return redirect({ href: "/sign-in", locale: await getLocale() });

  const { id, name, email } = session.user;
  const [balance, subscription, unread, cookieStore] = await Promise.all([
    userBalance(id),
    userSubscription(id),
    unreadCount(id),
    cookies(),
  ]);
  // SidebarProvider saves the collapsed state in this cookie.
  const open = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <CreditsProvider balance={balance}>
      <NotificationsProvider unread={unread}>
        <SidebarProvider defaultOpen={open}>
          <AppSidebar
            user={{ name, email, plan: subscription?.planId ?? null }}
            isAdmin={isAdmin(email)}
          />
          <SidebarInset id="main-content" className="bg-background">
            <MobileBar />
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-10">
              {children}
            </div>
            <FeedbackLink />
          </SidebarInset>
        </SidebarProvider>
      </NotificationsProvider>
    </CreditsProvider>
  );
}
