import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { VideoDetail } from "@/components/videos/video-detail";
import { log } from "@/server/log";
import { getVideo, refreshVideo } from "@/server/videos";

type Params = PageProps<"/[locale]/videos/[id]">["params"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Videos");
  return { title: t("detailTitle") };
}

// The video reads the request, so it streams in behind this page's own
// Suspense: the layout's boundary doesn't cover client navigations between
// dashboard pages. Another user's video, or an unknown id, gets the 404 page.
export default function VideoPage({ params }: PageProps<"/[locale]/videos/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton header />}>
      <VideoContent params={params} />
    </Suspense>
  );
}

// The layout guarantees a session.
async function VideoContent({ params }: { params: Params }) {
  const session = await currentSession();
  if (!session) return null;
  const { id } = await params;
  // Asks the provider once about a pending video. If it or storage fails,
  // show the video as stored; the next visit or the sweep collects it.
  const video = await refreshVideo(session.user.id, id).catch((error) => {
    log.error("video.refresh_failed", { id, error });
    return getVideo(session.user.id, id);
  });
  if (!video) notFound();

  return <VideoDetail video={video} />;
}
