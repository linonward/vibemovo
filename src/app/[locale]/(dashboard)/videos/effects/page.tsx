import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { EffectGenerator } from "@/components/videos/effect-generator";
import { listVideos, objectEffectOptions } from "@/server/videos";
import { MAX_IMAGE_BYTES } from "@/server/videos/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ObjectVideos");
  return { title: t("title") };
}

// The title is static. The rest reads the request, so it streams in behind
// this page's own Suspense, as on /videos.
export default async function ObjectVideosPage() {
  const t = await getTranslations("ObjectVideos");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <ObjectContent />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function ObjectContent() {
  const session = await currentSession();
  if (!session) return null;
  const [balance, videos] = await Promise.all([userBalance(session.user.id), listVideos(session.user.id)]);
  const options = objectEffectOptions();

  return (
    <EffectGenerator
      kind="object"
      balance={balance}
      credits={options.credits}
      maxImageBytes={MAX_IMAGE_BYTES}
      imageLimits={options.imageLimits}
      enabled={options.enabled}
      effects={options.effects}
      videos={videos}
    />
  );
}
