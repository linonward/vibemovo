import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { VideoLibrary } from "@/components/videos/video-library";
import { pageVideos } from "@/server/videos";
import { VIDEOS_PAGE_SIZE } from "@/server/videos/config";

type SearchParams = PageProps<"/[locale]/videos/library">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Videos");
  return { title: t("libraryTitle") };
}

// The title is static. The list reads the request, so it streams in behind
// this page's own Suspense: the layout's boundary doesn't cover client
// navigations between dashboard pages.
export default async function VideoLibraryPage({ searchParams }: PageProps<"/[locale]/videos/library">) {
  const t = await getTranslations("Videos");

  return (
    <>
      <PageHeader title={t("libraryTitle")} description={t("libraryDescription")} />
      <Suspense fallback={<PageSkeleton />}>
        <LibraryContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function LibraryContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await currentSession();
  if (!session) return null;
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(String(params.page), 10) || 1);
  const { videos, total } = await pageVideos(session.user.id, page);
  // A page past the last one.
  if (videos.length === 0 && total > 0) notFound();

  return <VideoLibrary videos={videos} page={page} pageCount={Math.ceil(total / VIDEOS_PAGE_SIZE)} />;
}
