import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { MetricsView } from "@/components/admin/metrics-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { isAdmin } from "@/server/admin/access";
import { METRICS_RANGES, recentMetrics } from "@/server/admin/metrics";

type SearchParams = PageProps<"/[locale]/admin/metrics">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("metrics.title") };
}

// Admins only, like /admin/users: everyone else gets the 404 page, and even
// the title waits for the admin check behind this page's own Suspense.
export default function AdminMetricsPage({ searchParams }: PageProps<"/[locale]/admin/metrics">) {
  return (
    <Suspense fallback={<PageSkeleton header />}>
      <AdminMetricsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminMetricsContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();

  const t = await getTranslations("Admin");
  // An unknown range falls back to 7 days, so a stale link still opens.
  const asked = Number((await searchParams).days);
  const days = METRICS_RANGES.find((value) => value === asked) ?? 7;
  const metrics = await recentMetrics(days);

  return (
    <>
      <PageHeader title={t("metrics.title")} description={t("metrics.description")} />
      <MetricsView metrics={metrics} days={days} ranges={METRICS_RANGES} />
    </>
  );
}
