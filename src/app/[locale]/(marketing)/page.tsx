import type { Metadata, ResolvingMetadata } from "next";
import { projectConfig } from "project.config";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Cta } from "@/components/home/cta";
import { Faq } from "@/components/home/faq";
import { Features } from "@/components/home/features";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Ideas } from "@/components/home/ideas";
import type { Locale } from "@/i18n/routing";
import { jsonLd, languageAlternates, website } from "@/lib/seo";

// The description comes from the locale layout. The title says what the site
// is next to its name: the layout's template would only add the name again.
export async function generateMetadata(
  { params }: PageProps<"/[locale]">,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Metadata");
  return {
    title: { absolute: t("homeTitle") },
    openGraph: {
      // Keep the layout's generated preview image when extending Open Graph.
      images: (await parent).openGraph?.images,
      type: "website",
      siteName: projectConfig.name,
      title: t("homeTitle"),
      description: t("description"),
      url: `/${locale}`,
    },
    alternates: { canonical: `/${locale}`, languages: languageAlternates("") },
  };
}

export default function Home() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
      <SiteData />
      <Hero />
      <Ideas />
      <Features />
      <HowItWorks />
      <Faq />
      <Cta />
    </main>
  );
}

// The site's name and publisher for search engines.
function SiteData() {
  const locale = useLocale() as Locale;
  const t = useTranslations("Metadata");
  // Prerendered, so set BETTER_AUTH_URL when building, as for canonical links.
  const data = website(locale, t("description"), process.env.BETTER_AUTH_URL);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
