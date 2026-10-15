import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ZombieLanding } from "@/components/landing/zombie-landing";
import type { Locale } from "@/i18n/routing";
import { postLocales } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";
import { signupCredits } from "@/server/credits/config";
import { RAP_MAX_IMAGE_BYTES, ZOMBIE_CREDITS } from "@/server/videos/config";

const PATH = "/ai-zombie-couple-video";
// The step-by-step guide to the zombie couple, linked where the locale has it.
const GUIDE = "ai-zombie-couple-video";

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-zombie-couple-video">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("ZombieLanding");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: `/${locale}${PATH}`, languages: languageAlternates(PATH) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/ai-zombie-couple-video">) {
  const { locale } = await params;
  const guide = (await postLocales(GUIDE)).includes(locale as Locale) ? `/blog/${GUIDE}` : undefined;
  return (
    <ZombieLanding
      facts={{
        credits: ZOMBIE_CREDITS,
        signup: signupCredits,
        maxImageMb: RAP_MAX_IMAGE_BYTES / (1024 * 1024),
      }}
      guide={guide}
    />
  );
}
