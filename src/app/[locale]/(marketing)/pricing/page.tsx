import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pricing } from "@/components/pricing/pricing";
import { languageAlternates } from "@/lib/seo";
import { CHAT_CREDIT_COST } from "@/server/ai/config";
import { signupCredits } from "@/server/credits/config";
import { imageCost } from "@/server/images/config";
import { CREDIT_PACKS } from "@/server/payment/packs";
import { offeredPlans } from "@/server/payment/subscriptions";
import { RAP_CREDITS, VIDEO_RESOLUTIONS } from "@/server/videos/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Pricing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `/${locale}/pricing`, languages: languageAlternates("/pricing") },
  };
}

export default function Page() {
  // The cheapest second of video any provider offers.
  const videoPerSecond = Math.min(...Object.values(VIDEO_RESOLUTIONS).flatMap((prices) => Object.values(prices)));
  return (
    <Pricing
      plans={offeredPlans()}
      packs={CREDIT_PACKS}
      costs={{ image: imageCost, chat: CHAT_CREDIT_COST, videoPerSecond, signup: signupCredits, rap: RAP_CREDITS }}
    />
  );
}
