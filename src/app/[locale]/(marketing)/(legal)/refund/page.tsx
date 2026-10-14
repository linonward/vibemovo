import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { projectConfig } from "project.config";
import { LegalPage } from "@/components/legal/legal-page";
import { languageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/refund">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Legal");
  return {
    title: t("refund"),
    description: t("descriptions.refund", { name: projectConfig.name }),
    alternates: { canonical: `/${locale}/refund`, languages: languageAlternates("/refund") },
  };
}

export default function Page() {
  return <LegalPage doc="refund" />;
}
