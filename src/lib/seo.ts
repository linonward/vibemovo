import { projectConfig } from "project.config";
import { type Locale, routing } from "@/i18n/routing";
import type { Post } from "./content";

// hreflang links for a page that exists in `locales`, keyed by locale plus
// x-default (the default locale's version, else the first one). `path` has
// no locale prefix; `base` is empty for metadata (metadataBase resolves it)
// or the site URL for the sitemap.
export function languageAlternates(
  path: string,
  locales: readonly Locale[] = routing.locales,
  base = "",
): Record<string, string> {
  const url = (locale: Locale) => `${base}/${locale}${path}`;
  const fallback = locales.includes(routing.defaultLocale) ? routing.defaultLocale : locales[0];
  return {
    ...Object.fromEntries(locales.map((locale) => [locale, url(locale)])),
    "x-default": url(fallback),
  };
}

// schema.org BlogPosting for a post's page, from what the page shows: the
// title, description, date and tags, by the site. `base` is the site URL;
// without it the URLs are left out, as JSON-LD has no metadataBase.
export function blogPosting(
  post: Pick<Post, "slug" | "title" | "description" | "date" | "tags">,
  locale: Locale,
  base?: string,
) {
  const url = (path: string) => (base ? new URL(path, base).href : undefined);
  const page = url(`/${locale}/blog/${post.slug}`);
  const home = url(`/${locale}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    ...(post.tags.length > 0 && { keywords: post.tags }),
    inLanguage: locale,
    ...(page && { url: page, mainEntityOfPage: page }),
    author: { "@type": "Organization", name: projectConfig.name, ...(home && { url: home }) },
  };
}

// schema.org WebSite and its publisher for the home page, so search engines
// show the site's name. `base` is the site URL; without it the URLs and IDs
// are left out.
export function website(locale: Locale, description: string, base?: string) {
  const name = projectConfig.name;
  const url = (path: string) => (base ? new URL(path, base).href : undefined);
  const id = (fragment: string) => url(`/#${fragment}`);
  const organization = id("organization");
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", ...(organization && { "@id": organization }), name, ...(base && { url: url("/") }) },
      {
        "@type": "WebSite",
        ...(base && { "@id": id("website") }),
        name,
        description,
        inLanguage: locale,
        // One WebSite identity for all languages, at the domain root.
        ...(base && { url: url("/") }),
        publisher: organization ? { "@id": organization } : { name },
      },
    ],
  };
}

// JSON for a <script type="application/ld+json">. "<" becomes \u003c, so a
// string can't close the script tag.
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
