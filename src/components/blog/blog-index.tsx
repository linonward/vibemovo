import { getLocale, getTranslations } from "next-intl/server";
import { listPosts, type Post } from "@/lib/content";
import { PostList } from "./post-list";

// The blog's posts, or with `tag`, that tag's posts.
export async function BlogIndex({ tag }: { tag?: { name: string; posts: Post[] } }) {
  const locale = await getLocale();
  const t = await getTranslations("Blog");
  const posts = tag?.posts ?? (await listPosts(locale));

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display-tight font-display text-3xl font-bold text-balance sm:text-4xl">
          {tag ? t("tagged", { tag: tag.name }) : t("title")}
        </h1>
        {!tag && <p className="text-lg text-pretty text-muted-foreground">{t("description")}</p>}
      </header>
      <PostList posts={posts} />
    </main>
  );
}
