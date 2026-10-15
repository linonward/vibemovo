import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EffectLanding } from "@/components/landing/effect-landing";
import type { Locale } from "@/i18n/routing";
import { postLocales, relatedPosts } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";
import { signupCredits } from "@/server/credits/config";
import { RAP_IMAGE_LIMITS, RAP_MAX_IMAGE_BYTES } from "@/server/videos/config";
import { vampire } from "@/server/videos/vampire";

const PATH = "/ai-vampire-transformation-video";
// The step-by-step guide to the vampire transformation, linked where the locale has it.
const GUIDE = "ai-vampire-transformation-video";
// Other guides the page links, where the locale has them.
const RELATED = ["ai-zombie-couple-video", "photo-to-video-ai"];

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-vampire-transformation-video">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("VampireLanding");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: `/${locale}${PATH}`, languages: languageAlternates(PATH) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/ai-vampire-transformation-video">) {
  const { locale } = await params;
  const guide = (await postLocales(GUIDE)).includes(locale as Locale) ? `/blog/${GUIDE}` : undefined;
  const related = await relatedPosts(locale as Locale, RELATED);
  return (
    <EffectLanding
      kind="vampire"
      facts={{
        credits: vampire.credits,
        signup: signupCredits,
        maxImageBytes: RAP_MAX_IMAGE_BYTES,
        imageLimits: RAP_IMAGE_LIMITS,
      }}
      guide={guide}
      related={related}
    />
  );
}
