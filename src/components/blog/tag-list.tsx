import { Link } from "@/i18n/navigation";

// A post's tags as links to their pages. `relative` lifts them above a
// card's full-size link.
export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="relative flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/blog/tags/${encodeURIComponent(tag)}`}
            className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)] [@media(hover:hover)]:hover:text-foreground"
          >
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
