import { expect, test } from "vitest";
import { blogPosting, jsonLd, languageAlternates, website } from "./seo";

test("links every locale and defaults to English", () => {
  expect(languageAlternates("/blog")).toEqual({ en: "/en/blog", zh: "/zh/blog", "x-default": "/en/blog" });
});

test("links only the locales that have the page", () => {
  expect(languageAlternates("/blog/a", ["zh"], "https://x.test")).toEqual({
    zh: "https://x.test/zh/blog/a",
    "x-default": "https://x.test/zh/blog/a",
  });
});

const post = { slug: "a", title: "A post", description: "What it says.", date: "2026-10-01", tags: ["guides", "news"] };

test("describes a post with what its page shows", () => {
  expect(blogPosting(post, "zh", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: "A post",
    description: "What it says.",
    datePublished: "2026-10-01",
    keywords: ["guides", "news"],
    inLanguage: "zh",
    url: "https://x.test/zh/blog/a",
    mainEntityOfPage: "https://x.test/zh/blog/a",
    author: { "@type": "Organization", name: "vibemovo", url: "https://x.test/zh" },
  });
});

test("leaves out the URLs without a base URL", () => {
  const data = blogPosting({ ...post, tags: [] }, "en");
  expect(data).not.toHaveProperty("url");
  expect(data).not.toHaveProperty("mainEntityOfPage");
  expect(data).not.toHaveProperty("keywords");
  expect(data.author).toEqual({ "@type": "Organization", name: "vibemovo" });
});

test("escapes < so a title can't close the script tag", () => {
  expect(jsonLd({ headline: "</script><script>alert(1)</script>" })).toBe(
    '{"headline":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}',
  );
});

test("names the site and its publisher for the home page", () => {
  expect(website("zh", "What it does.", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://x.test/#organization", name: "vibemovo", url: "https://x.test/" },
      {
        "@type": "WebSite",
        "@id": "https://x.test/#website",
        name: "vibemovo",
        description: "What it does.",
        inLanguage: "zh",
        url: "https://x.test/",
        publisher: { "@id": "https://x.test/#organization" },
      },
    ],
  });
});

test("leaves the site's URLs out without a base URL", () => {
  expect(website("en", "What it does.")).toEqual({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "vibemovo" },
      { "@type": "WebSite", name: "vibemovo", description: "What it does.", inLanguage: "en", publisher: { name: "vibemovo" } },
    ],
  });
});
