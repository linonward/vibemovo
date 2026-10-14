import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { ImageLibrary } from "@/components/images/image-library";
import { pageImages } from "@/server/images";
import { IMAGES_PAGE_SIZE } from "@/server/images/config";

type SearchParams = PageProps<"/[locale]/images/library">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Images");
  return { title: t("libraryTitle") };
}

// The title is static. The list reads the request, so it streams in behind
// this page's own Suspense: the layout's boundary doesn't cover client
// navigations between dashboard pages.
export default async function ImageLibraryPage({ searchParams }: PageProps<"/[locale]/images/library">) {
  const t = await getTranslations("Images");

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
  const { images, total } = await pageImages(session.user.id, page);
  // A page past the last one.
  if (images.length === 0 && total > 0) notFound();

  return <ImageLibrary images={images} page={page} pageCount={Math.ceil(total / IMAGES_PAGE_SIZE)} />;
}
