import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EffectLanding } from "@/components/landing/effect-landing";
import type { Locale } from "@/i18n/routing";
import { postLocales, relatedPosts } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";
import { signupCredits } from "@/server/credits/config";
import { RAINDANCE_CREDITS, RAP_IMAGE_LIMITS, RAP_MAX_IMAGE_BYTES } from "@/server/videos/config";

const PATH = "/raindance-ai-trend";
// The step-by-step guide to the raindance duo, linked where the locale has it.
const GUIDE = "raindance-ai-trend";
// Other guides the page links, where the locale has them.
const RELATED = ["ai-zombie-couple-video", "ai-rap-video-two-people"];

export async function generateMetadata({ params }: PageProps<"/[locale]/raindance-ai-trend">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("RaindanceLanding");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: `/${locale}${PATH}`, languages: languageAlternates(PATH) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/raindance-ai-trend">) {
  const { locale } = await params;
  const guide = (await postLocales(GUIDE)).includes(locale as Locale) ? `/blog/${GUIDE}` : undefined;
  const related = await relatedPosts(locale as Locale, RELATED);
  return (
    <EffectLanding
      kind="raindance"
      facts={{
        credits: RAINDANCE_CREDITS,
        signup: signupCredits,
        maxImageBytes: RAP_MAX_IMAGE_BYTES,
        imageLimits: RAP_IMAGE_LIMITS,
      }}
      guide={guide}
      related={related}
    />
  );
}
