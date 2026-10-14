import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { ImageDetail } from "@/components/images/image-detail";
import { getImage, refreshImage } from "@/server/images";
import { log } from "@/server/log";

type Params = PageProps<"/[locale]/images/[id]">["params"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Images");
  return { title: t("detailTitle") };
}

// The image reads the request, so it streams in behind this page's own
// Suspense: the layout's boundary doesn't cover client navigations between
// dashboard pages. Another user's image, or an unknown id, gets the 404 page.
export default function ImagePage({ params }: PageProps<"/[locale]/images/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton header />}>
      <ImageContent params={params} />
    </Suspense>
  );
}

// The layout guarantees a session.
async function ImageContent({ params }: { params: Params }) {
  const session = await currentSession();
  if (!session) return null;
  const { id } = await params;
  // Asks Bailian once about a pending image. If Bailian or storage fails,
  // show the image as stored; the next visit or the sweep collects it.
  const image = await refreshImage(session.user.id, id).catch((error) => {
    log.error("image.refresh_failed", { id, error });
    return getImage(session.user.id, id);
  });
  if (!image) notFound();

  return <ImageDetail image={image} />;
}
