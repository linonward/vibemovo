import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Post } from "@/lib/content";
import { PostDate } from "./post-date";
import { TagList } from "./tag-list";

export async function PostList({ posts }: { posts: Post[] }) {
  const t = await getTranslations("Blog");

  if (posts.length === 0) {
    return <p className="rounded-xl border border-dashed px-5 py-8 text-center text-muted-foreground">{t("empty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {posts.map((post) => (
        <li key={post.slug}>
          <article className="relative flex flex-col gap-2 rounded-xl border bg-card p-5 transition-colors duration-150 sm:p-6 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]">
            <PostDate date={post.date} />
            <h2 className="font-display text-lg font-semibold">
              <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                {post.title}
              </Link>
            </h2>
            <p className="text-pretty text-muted-foreground">{post.description}</p>
            <TagList tags={post.tags} />
          </article>
        </li>
      ))}
    </ul>
  );
}
