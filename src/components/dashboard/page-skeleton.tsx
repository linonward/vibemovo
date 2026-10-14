import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

// Fallback for a dashboard page's content while it reads the request: a
// panel and a larger block in outline, as in ShellSkeleton. `header` adds
// the PageHeader's title and description, for pages that wait to render
// their header too. Screen readers hear the label only. Admin list pages
// use ListSkeleton, which draws their search bar and table.
export function PageSkeleton({ header = false }: { header?: boolean }) {
  const t = useTranslations("Dashboard");

  return (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-8">
      {header && (
        <div aria-hidden className="flex flex-col gap-1">
          <Skeleton className="h-9 w-48 sm:h-10" />
          <Skeleton className="my-1 h-4 w-64 max-w-full" />
        </div>
      )}
      <Skeleton aria-hidden className="h-28 rounded-xl" />
      <Skeleton aria-hidden className="h-64 rounded-xl" />
    </div>
  );
}
