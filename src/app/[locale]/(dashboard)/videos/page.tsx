import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { VideoGenerator } from "@/components/videos/video-generator";
import { listVideos, videoOptions } from "@/server/videos";
import { MAX_IMAGE_BYTES, MAX_PROMPT_LENGTH, VIDEO_DURATIONS } from "@/server/videos/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Videos");
  return { title: t("title") };
}

// The title is static. The rest reads the request, so it streams in behind
// this page's own Suspense: the layout's boundary doesn't cover client
// navigations between dashboard pages.
export default async function VideosPage() {
  const t = await getTranslations("Videos");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <VideosContent />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function VideosContent() {
  const session = await currentSession();
  if (!session) return null;
  const [balance, videos] = await Promise.all([
    userBalance(session.user.id),
    listVideos(session.user.id),
  ]);
  const options = videoOptions();

  return (
    <VideoGenerator
      balance={balance}
      resolutions={options.resolutions}
      imageLimits={options.imageLimits}
      durations={VIDEO_DURATIONS}
      maxPromptLength={MAX_PROMPT_LENGTH}
      maxImageBytes={MAX_IMAGE_BYTES}
      enabled={options.enabled}
      videos={videos}
    />
  );
}
