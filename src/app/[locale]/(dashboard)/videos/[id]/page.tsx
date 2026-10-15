import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { EffectGenerator } from "@/components/videos/effect-generator";
import { VideoDetail } from "@/components/videos/video-detail";
import { log } from "@/server/log";
import { effectOptions, getVideo, listVideos, type PhotoEffectKind, photoEffect, refreshVideo } from "@/server/videos";
import { RAP_IMAGE_LIMITS, RAP_MAX_IMAGE_BYTES } from "@/server/videos/config";

type Params = PageProps<"/[locale]/videos/[id]">["params"];

// /videos/<kind> is a photo effect's form (PHOTO_EFFECTS); any other
// segment is a video's ID.
export async function generateMetadata({ params }: PageProps<"/[locale]/videos/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (photoEffect(id)) {
    const t = await getTranslations("PhotoEffects");
    return { title: t(`kinds.${id as PhotoEffectKind}.title`) };
  }
  const t = await getTranslations("Videos");
  return { title: t("detailTitle") };
}

// The page reads the request, so it streams in behind this page's own
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
  if (photoEffect(id)) return <EffectContent kind={id as PhotoEffectKind} userId={session.user.id} />;
  // Asks the provider once about a pending video. If it or storage fails,
  // show the video as stored; the next visit or the sweep collects it.
  const video = await refreshVideo(session.user.id, id).catch((error) => {
    log.error("video.refresh_failed", { id, error });
    return getVideo(session.user.id, id);
  });
  if (!video) notFound();

  return <VideoDetail video={video} />;
}

async function EffectContent({ kind, userId }: { kind: PhotoEffectKind; userId: string }) {
  const t = await getTranslations("PhotoEffects");
  const [balance, videos] = await Promise.all([userBalance(userId), listVideos(userId)]);
  const options = effectOptions(kind);

  return (
    <>
      <PageHeader title={t(`kinds.${kind}.title`)} description={t(`kinds.${kind}.description`)} />
      <EffectGenerator
        kind={kind}
        balance={balance}
        credits={options.credits}
        maxImageBytes={RAP_MAX_IMAGE_BYTES}
        imageLimits={RAP_IMAGE_LIMITS}
        enabled={options.enabled}
        videos={videos}
      />
    </>
  );
}
