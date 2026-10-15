import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { MDXContent } from "mdx/types";
import { type Locale, routing } from "@/i18n/routing";

export const LEGAL_DOCS = ["privacy", "terms", "refund"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

// Loads content/legal/<locale>/<doc>.mdx.
export async function loadLegalDoc(
  locale: Locale,
  doc: LegalDoc,
): Promise<MDXContent> {
  return (await import(`@content/legal/${locale}/${doc}.mdx`)).default;
}

export type Post = {
  slug: string;
  title: string;
  description: string;
  // YYYY-MM-DD.
  date: string;
  // In the post's own language, such as "guides" or "公告".
  tags: string[];
  Content: MDXContent;
};

// /blog/tags/<tag> lists a tag's posts, so no post may be called "tags".
const RESERVED_SLUGS = ["tags"];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The slugs of content/blog/<locale>/*.mdx. Cached, so pages that list
// posts can prerender: posts change only with a deploy.
async function postSlugs(locale: Locale): Promise<string[]> {
  "use cache";
  const files = await readdir(join(process.cwd(), "content/blog", locale)).catch(() => []);
  const slugs = files.filter((file) => file.endsWith(".mdx")).map((file) => file.slice(0, -4));
  const reserved = slugs.find((slug) => RESERVED_SLUGS.includes(slug));
  if (reserved) throw new Error(`content/blog/${locale}/${reserved}.mdx: "${reserved}" is reserved; rename the post`);
  return slugs;
}

// Loads content/blog/<locale>/<slug>.mdx, or null if the locale has no such
// post. Throws if the post's metadata is missing or malformed.
export async function loadPost(locale: Locale, slug: string): Promise<Post | null> {
  if (!SLUG.test(slug) || !(await postSlugs(locale)).includes(slug)) return null;
  const mod = await import(`@content/blog/${locale}/${slug}.mdx`);
  const { title, description, date, tags = [] } = mod.metadata ?? {};
  if (typeof title !== "string" || typeof description !== "string" || !DATE.test(date)) {
    throw new Error(`content/blog/${locale}/${slug}.mdx: metadata needs a title, a description and a YYYY-MM-DD date`);
  }
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string" && tag.trim() && !/[/%]/.test(tag))) {
    throw new Error(`content/blog/${locale}/${slug}.mdx: tags must be a list of words without "/" or "%"`);
  }
  return { slug, title, description, date, tags, Content: mod.default };
}

// A locale's posts, newest first.
export async function listPosts(locale: Locale): Promise<Post[]> {
  const posts = await Promise.all((await postSlugs(locale)).map((slug) => loadPost(locale, slug)));
  return posts
    .filter((post): post is Post => post !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// The locale's posts among these slugs, as links, newest first.
export async function relatedPosts(locale: Locale, slugs: string[]): Promise<{ href: string; title: string }[]> {
  return (await listPosts(locale))
    .filter((post) => slugs.includes(post.slug))
    .map((post) => ({ href: `/blog/${post.slug}`, title: post.title }));
}

// The locales that have a post with this slug.
export async function postLocales(slug: string): Promise<Locale[]> {
  const found = await Promise.all(
    routing.locales.map(async (locale) => ((await postSlugs(locale)).includes(slug) ? locale : null)),
  );
  return found.filter((locale): locale is Locale => locale !== null);
}

// A locale's tags, sorted.
export async function listTags(locale: Locale): Promise<string[]> {
  const tags = (await listPosts(locale)).flatMap((post) => post.tags);
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b, locale));
}
