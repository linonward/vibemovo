import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { NotificationList } from "@/components/notifications/notification-list";
import { pageNotifications } from "@/server/notifications";
import { NOTIFICATIONS_PAGE_SIZE } from "@/server/notifications/config";

type SearchParams = PageProps<"/[locale]/notifications">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title") };
}

// The title is static. The list reads the request, so it streams in behind
// this page's own Suspense.
export default async function NotificationsPage({ searchParams }: PageProps<"/[locale]/notifications">) {
  const t = await getTranslations("Notifications");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <NotificationsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function NotificationsContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await currentSession();
  if (!session) return null;
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(String(params.page), 10) || 1);
  const { notifications, total } = await pageNotifications(session.user.id, page);
  // A page past the last one.
  if (notifications.length === 0 && total > 0) notFound();

  return (
    <NotificationList
      // A new page or a refresh starts from the stored state.
      key={page}
      notifications={notifications}
      page={page}
      pageCount={Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)}
    />
  );
}
