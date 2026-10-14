import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const linkClass =
  "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-accent";

// Previous and next links for an admin list. `params` are the list's other
// search params; empty ones are dropped.
export function AdminPagination({
  pathname,
  params = {},
  page,
  pageCount,
}: {
  pathname: string;
  params?: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("Admin");
  if (pageCount <= 1) return null;

  const kept = Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const href = (to: number) => ({ pathname, query: { ...kept, page: String(to) } });

  return (
    <nav aria-label={t("pages")} className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("pageOf", { page, pages: pageCount })}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={linkClass}>
            <ChevronLeft className="size-4" />
            {t("previous")}
          </Link>
        )}
        {page < pageCount && (
          <Link href={href(page + 1)} className={linkClass}>
            {t("next")}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}
