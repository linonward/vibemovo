import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { BroadcastTable } from "@/components/admin/broadcast-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { isAdmin } from "@/server/admin/access";
import { listBroadcasts } from "@/server/notifications/broadcasts";
import { MAX_BROADCAST_BODY, MAX_BROADCAST_TITLE } from "@/server/notifications/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.broadcasts");
  return { title: t("title") };
}

// Admins only, like the other admin pages: everyone else gets the 404 page,
// and even the title waits for the admin check behind this page's own Suspense.
export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton header />}>
      <AdminNotificationsContent />
    </Suspense>
  );
}

async function AdminNotificationsContent() {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();

  const t = await getTranslations("Admin.broadcasts");
  const broadcasts = await listBroadcasts();

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <BroadcastForm maxTitle={MAX_BROADCAST_TITLE} maxBody={MAX_BROADCAST_BODY} />
      <section aria-labelledby="broadcast-history" className="flex flex-col gap-4">
        <h2 id="broadcast-history" className="text-lg font-bold">
          {t("historyTitle")}
        </h2>
        <BroadcastTable broadcasts={broadcasts} />
      </section>
    </>
  );
}
