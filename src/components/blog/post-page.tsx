import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Post } from "@/lib/content";
import { PostDate } from "./post-date";
import { TagList } from "./tag-list";

export async function PostPage({ post }: { post: Post }) {
  const t = await getTranslations("Blog");
  const { Content } = post;

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-12 sm:px-8 sm:py-16">
      <Link
        href="/blog"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <PostDate date={post.date} />
          <h1 className="display-tight font-display text-3xl font-bold text-balance sm:text-4xl">{post.title}</h1>
          <p className="text-lg text-pretty text-muted-foreground">{post.description}</p>
          <TagList tags={post.tags} />
        </header>
        <div className="legal-prose border-t pt-8">
          <Content />
        </div>
      </article>
    </main>
  );
}
