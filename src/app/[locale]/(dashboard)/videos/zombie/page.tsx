import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { EffectGenerator } from "@/components/videos/effect-generator";
import { listVideos, zombieOptions } from "@/server/videos";
import { RAP_IMAGE_LIMITS, RAP_MAX_IMAGE_BYTES } from "@/server/videos/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ZombieVideos");
  return { title: t("title") };
}

// The title is static. The rest reads the request, so it streams in behind
// this page's own Suspense, as on /videos.
export default async function ZombieVideosPage() {
  const t = await getTranslations("ZombieVideos");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <ZombieContent />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function ZombieContent() {
  const session = await currentSession();
  if (!session) return null;
  const [balance, videos] = await Promise.all([userBalance(session.user.id), listVideos(session.user.id)]);
  const options = zombieOptions();

  return (
    <EffectGenerator
      kind="zombie"
      balance={balance}
      credits={options.credits}
      maxImageBytes={RAP_MAX_IMAGE_BYTES}
      imageLimits={RAP_IMAGE_LIMITS}
      enabled={options.enabled}
      videos={videos}
    />
  );
}
