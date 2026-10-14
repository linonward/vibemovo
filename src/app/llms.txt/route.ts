import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { projectConfig } from "project.config";
import { LOCALE_NAMES, type Locale, routing } from "@/i18n/routing";
import { LEGAL_DOCS, listPosts } from "@/lib/content";
// Every locale has the same keys (a unit test checks), so en's list them all.
import messages from "../../../messages/en.json";

const keys = <T extends object>(items: T) => Object.keys(items) as (keyof T & string)[];

// A Markdown summary of the product for language models (llmstxt.org): what
// it is, its features and FAQ in the default locale, and links to the
// public pages in every locale. The text comes from messages/*.json, so it
// follows the landing page.
export async function GET() {
  // Read BETTER_AUTH_URL per request, as the sitemap does.
  await connection();
  const url = (path: string) => new URL(path, process.env.BETTER_AUTH_URL).href;

  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "Home" });
  const meta = await getTranslations({ locale: routing.defaultLocale, namespace: "Metadata" });
  const email = () => projectConfig.supportEmail;
  const features = keys(messages.Home.features.items).map(
    (key) => `- ${t(`features.items.${key}.title`)}: ${t(`features.items.${key}.body`)}`,
  );
  const faq = keys(messages.Home.faq.items).map(
    (key) => `- ${t(`faq.items.${key}.title`)}: ${t.markup(`faq.items.${key}.body`, { email })}`,
  );

  const pages = async (locale: Locale) => {
    const home = await getTranslations({ locale, namespace: "Home" });
    const legal = await getTranslations({ locale, namespace: "Legal" });
    const pricing = await getTranslations({ locale, namespace: "Pricing" });
    const blog = await getTranslations({ locale, namespace: "Blog" });
    return [
      `- [${projectConfig.name}](${url(`/${locale}`)}): ${home("hero.title")}`,
      ...LEGAL_DOCS.map((doc) => `- [${legal(doc)}](${url(`/${locale}/${doc}`)})`),
      `- [${pricing("title")}](${url(`/${locale}/pricing`)}): ${pricing("description")}`,
      `- [${blog("title")}](${url(`/${locale}/blog`)}): ${blog("description")}`,
      ...(await listPosts(locale)).map(
        (post) => `- [${post.title}](${url(`/${locale}/blog/${post.slug}`)}): ${post.description}`,
      ),
    ];
  };

  // Each section is a heading and a list, as llmstxt.org lays them out.
  const section = (heading: string, lines: string[]) => `## ${heading}\n\n${lines.join("\n")}`;
  const body = [
    `# ${projectConfig.name}`,
    `> ${meta("description")}`,
    t("hero.body"),
    section(t("features.title"), features),
    section(t("faq.title"), faq),
    ...(await Promise.all(routing.locales.map(async (locale) => section(LOCALE_NAMES[locale], await pages(locale))))),
    section("Optional", [`- [Sitemap](${url("/sitemap.xml")})`]),
  ].join("\n\n");

  return new Response(`${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
