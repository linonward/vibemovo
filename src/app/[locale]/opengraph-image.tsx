import { getTranslations } from "next-intl/server";
import { projectConfig } from "project.config";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/app/_lib/og-image";
import { type Locale, routing } from "@/i18n/routing";

// The preview image for every page under the locale without one of its own.
export const alt = projectConfig.name;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Rendered at build time, like the pages.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  return ogImage({ title: t("tagline"), description: t("description"), locale });
}
