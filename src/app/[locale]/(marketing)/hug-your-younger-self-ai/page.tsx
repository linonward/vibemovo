import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EffectLanding } from "@/components/landing/effect-landing";
import type { Locale } from "@/i18n/routing";
import { postLocales } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";
import { signupCredits } from "@/server/credits/config";
import { HUG_CREDITS, RAP_MAX_IMAGE_BYTES } from "@/server/videos/config";

const PATH = "/hug-your-younger-self-ai";
// The step-by-step guide to the younger-self hug, linked where the locale has it.
const GUIDE = "hug-your-younger-self-ai";

export async function generateMetadata({ params }: PageProps<"/[locale]/hug-your-younger-self-ai">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("HugLanding");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: `/${locale}${PATH}`, languages: languageAlternates(PATH) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/hug-your-younger-self-ai">) {
  const { locale } = await params;
  const guide = (await postLocales(GUIDE)).includes(locale as Locale) ? `/blog/${GUIDE}` : undefined;
  return (
    <EffectLanding
      kind="hug"
      facts={{
        credits: HUG_CREDITS,
        signup: signupCredits,
        maxImageMb: RAP_MAX_IMAGE_BYTES / (1024 * 1024),
      }}
      guide={guide}
    />
  );
}
