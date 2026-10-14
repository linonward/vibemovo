import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BlogIndex } from "@/components/blog/blog-index";
import { languageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Blog");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `/${locale}/blog`, languages: languageAlternates("/blog") },
  };
}

export default function Page() {
  return <BlogIndex />;
}
