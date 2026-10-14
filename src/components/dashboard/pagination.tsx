import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const linkClass =
  "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-accent";

// Previous and Next links for a list paged with ?page=N. Nothing for one page.
export function Pagination({
  pathname,
  page,
  pageCount,
}: {
  pathname: "/images/library" | "/videos/library" | "/notifications";
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("Dashboard");
  if (pageCount <= 1) return null;

  const href = (to: number) => ({ pathname, query: { page: String(to) } });

  return (
    <nav aria-label={t("pages")} className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">{t("pageOf", { page, pages: pageCount })}</p>
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
