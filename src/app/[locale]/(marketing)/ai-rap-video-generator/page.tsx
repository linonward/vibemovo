import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RapLanding } from "@/components/landing/rap-landing";
import type { Locale } from "@/i18n/routing";
import { postLocales } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";
import { signupCredits } from "@/server/credits/config";
import { RAP_CREDITS, RAP_MAX_IMAGE_BYTES, RAP_MAX_NAME_LENGTH } from "@/server/videos/config";

const PATH = "/ai-rap-video-generator";
// The step-by-step guide to the rap duo, linked where the locale has it.
const GUIDE = "ai-rap-video-two-people";

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-rap-video-generator">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("RapLanding");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `/${locale}${PATH}`, languages: languageAlternates(PATH) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/ai-rap-video-generator">) {
  const { locale } = await params;
  const guide = (await postLocales(GUIDE)).includes(locale as Locale) ? `/blog/${GUIDE}` : undefined;
  return (
    <RapLanding
      facts={{
        credits: RAP_CREDITS,
        signup: signupCredits,
        maxImageMb: RAP_MAX_IMAGE_BYTES / (1024 * 1024),
        maxNameLength: RAP_MAX_NAME_LENGTH,
      }}
      guide={guide}
    />
  );
}
