import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BlogIndex } from "@/components/blog/blog-index";
import { type Locale, routing } from "@/i18n/routing";
import { listPosts, listTags } from "@/lib/content";

// Every locale's tags. Cache Components needs at least one param, so with
// no tags at all a placeholder renders the 404 page.
export async function generateStaticParams() {
  const params = (
    await Promise.all(routing.locales.map(async (locale) => (await listTags(locale)).map((tag) => ({ locale, tag }))))
  ).flat();
  return params.length > 0 ? params : [{ locale: routing.defaultLocale, tag: "none" }];
}

// The tag and its posts, or null if no post in the locale has it.
async function tagged(params: PageProps<"/[locale]/blog/tags/[tag]">["params"]) {
  const { locale, tag } = await params;
  const name = decodeURIComponent(tag);
  const posts = (await listPosts(locale as Locale)).filter((post) => post.tags.includes(name));
  return posts.length > 0 ? { locale, name, posts } : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/tags/[tag]">): Promise<Metadata> {
  const found = await tagged(params);
  if (!found) return {};
  const t = await getTranslations("Blog");
  return {
    title: t("tagged", { tag: found.name }),
    description: t("taggedDescription", { tag: found.name }),
    alternates: { canonical: `/${found.locale}/blog/tags/${encodeURIComponent(found.name)}` },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/blog/tags/[tag]">) {
  const found = await tagged(params);
  if (!found) notFound();
  return <BlogIndex tag={{ name: found.name, posts: found.posts }} />;
}
