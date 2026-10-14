import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostPage } from "@/components/blog/post-page";
import { type Locale, routing } from "@/i18n/routing";
import { listPosts, loadPost, postLocales } from "@/lib/content";
import { blogPosting, jsonLd, languageAlternates } from "@/lib/seo";

// Every locale's posts. Cache Components needs at least one param, so with
// no posts at all a placeholder renders the 404 page.
export async function generateStaticParams() {
  const params = (
    await Promise.all(
      routing.locales.map(async (locale) => (await listPosts(locale)).map((post) => ({ locale, slug: post.slug }))),
    )
  ).flat();
  return params.length > 0 ? params : [{ locale: routing.defaultLocale, slug: "none" }];
}

async function post(params: PageProps<"/[locale]/blog/[slug]">["params"]) {
  const { locale, slug } = await params;
  return loadPost(locale as Locale, slug);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const found = await post(params);
  if (!found) return {};
  const { locale } = await params;
  const path = `/blog/${found.slug}`;
  return {
    title: found.title,
    description: found.description,
    alternates: { canonical: `/${locale}${path}`, languages: languageAlternates(path, await postLocales(found.slug)) },
    openGraph: { type: "article", title: found.title, description: found.description, publishedTime: found.date },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const found = await post(params);
  if (!found) notFound();
  const { locale } = await params;
  // Prerendered, so set BETTER_AUTH_URL when building, as for canonical links.
  const data = blogPosting(found, locale as Locale, process.env.BETTER_AUTH_URL);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <PostPage post={found} />
    </>
  );
}
