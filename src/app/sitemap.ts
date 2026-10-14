import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { routing } from "@/i18n/routing";
import { LEGAL_DOCS, listPosts, postLocales } from "@/lib/content";
import { languageAlternates } from "@/lib/seo";

// The public pages in every locale, without the locale prefix.
const PAGES = ["", ...LEGAL_DOCS.map((doc) => `/${doc}`), "/pricing", "/ai-rap-video-generator", "/blog"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Read BETTER_AUTH_URL per request, so a build doesn't bake in its own URL.
  await connection();
  const base = new URL(process.env.BETTER_AUTH_URL ?? "").origin;

  const pages = PAGES.flatMap((page) => {
    const languages = languageAlternates(page, routing.locales, base);
    return routing.locales.map((locale) => ({ url: languages[locale], alternates: { languages } }));
  });

  // Each locale has its own posts; a post links only the translations that exist.
  const posts = await Promise.all(
    routing.locales.map(async (locale) =>
      Promise.all(
        (await listPosts(locale)).map(async (post) => {
          const languages = languageAlternates(`/blog/${post.slug}`, await postLocales(post.slug), base);
          return { url: languages[locale], lastModified: post.date, alternates: { languages } };
        }),
      ),
    ),
  );

  return [...pages, ...posts.flat()];
}
