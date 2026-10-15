import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTranslations } from "next-intl/server";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/app/_lib/og-image";
import { type Locale, routing } from "@/i18n/routing";
import en from "../../../../../messages/en.json";
import zh from "../../../../../messages/zh.json";

// The page's preview image: its title over a real result, frames the page
// itself shows.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Rendered at build time, like the page.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The alt text is the page's title in each locale. Next.js runs this like
// generateStaticParams, where next-intl can't read the locale, so it reads
// the messages directly.
const TITLES: Record<Locale, string> = { en: en.RaindanceLanding.title, zh: zh.RaindanceLanding.title };

export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return [{ id: "preview", alt: TITLES[locale as Locale], size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "RaindanceLanding" });
  return ogImage({ title: t("title"), description: t("description"), locale, photo: await frames() });
}

// Three of the frames the page shows, cropped to the 16:9 ogImage expects,
// as a data URL. Cached: the image renders on request, as
// generateImageMetadata's id segment isn't prerendered.
async function frames() {
  "use cache";
  const file = await readFile(join(process.cwd(), "public/landing/raindance/preview.jpg"));
  return `data:image/jpeg;base64,${file.toString("base64")}`;
}
