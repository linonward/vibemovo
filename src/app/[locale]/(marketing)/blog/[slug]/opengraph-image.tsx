import { notFound } from "next/navigation";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/app/_lib/og-image";
import type { Locale } from "@/i18n/routing";
import { loadPost } from "@/lib/content";

// A post's preview image shows its title and description.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Rendered at build time, one per post, like the pages.
export { generateStaticParams } from "./page";

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const post = await loadPost(locale as Locale, slug);
  if (!post) notFound();
  return ogImage({ title: post.title, description: post.description, locale });
}
