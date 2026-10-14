import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { FeedbackList } from "@/components/admin/feedback-list";
import { AdminPagination } from "@/components/admin/pagination";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { isAdmin } from "@/server/admin/access";
import { listFeedback } from "@/server/feedback";
import { FEEDBACK_PAGE_SIZE } from "@/server/feedback/config";

type Props = PageProps<"/[locale]/admin/feedback">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.feedback");
  return { title: t("title") };
}

export default function AdminFeedbackPage({ searchParams }: Props) {
  return <Suspense fallback={<PageSkeleton header />}><FeedbackContent searchParams={searchParams} /></Suspense>;
}

async function FeedbackContent({ searchParams }: Pick<Props, "searchParams">) {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();
  const t = await getTranslations("Admin.feedback");
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) notFound();
  const { items, total } = await listFeedback({ page });
  const pageCount = Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE));
  if (page > pageCount) notFound();
  return (
    <>
      <PageHeader title={t("title")} description={t("description", { total })} />
      <FeedbackList items={items} />
      <AdminPagination pathname="/admin/feedback" page={page} pageCount={pageCount} />
    </>
  );
}
