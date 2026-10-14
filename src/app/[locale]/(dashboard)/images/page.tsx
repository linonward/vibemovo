import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userBalance } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { ImageGenerator } from "@/components/images/image-generator";
import { imagesEnabled, listImages } from "@/server/images";
import { IMAGE_ASPECTS, imageCost, MAX_PROMPT_LENGTH, RECENT_IMAGES } from "@/server/images/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Images");
  return { title: t("title") };
}

// The title is static. The rest reads the request, so it streams in behind
// this page's own Suspense: the layout's boundary doesn't cover client
// navigations between dashboard pages.
export default async function ImagesPage() {
  const t = await getTranslations("Images");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <ImagesContent />
      </Suspense>
    </>
  );
}

// The layout guarantees a session.
async function ImagesContent() {
  const session = await currentSession();
  if (!session) return null;
  const [balance, images] = await Promise.all([
    userBalance(session.user.id),
    listImages(session.user.id, RECENT_IMAGES),
  ]);

  return (
    <ImageGenerator
      balance={balance}
      cost={imageCost}
      aspects={IMAGE_ASPECTS}
      maxPromptLength={MAX_PROMPT_LENGTH}
      enabled={imagesEnabled()}
      images={images}
    />
  );
}
