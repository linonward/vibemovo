import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 8;

// Fallback for an admin list page while the admin check and the query run:
// page header, the search or filter bar, and the table in outline, laid out
// like the real page so nothing jumps when it arrives. `columns` are the
// width (and breakpoint) classes of each cell's bar; `action` adds the
// trailing icon button a row may have. Screen readers hear the label only.
export function ListSkeleton({
  controls,
  columns,
  action = false,
}: {
  controls: "search" | "filters";
  columns: string[];
  action?: boolean;
}) {
  const t = useTranslations("Admin");

  return (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-8">
      <div aria-hidden className="flex flex-col gap-1">
        <Skeleton className="h-9 w-40 sm:h-10" />
        <Skeleton className="my-1 h-4 w-28" />
      </div>
      <div aria-hidden className="flex flex-col gap-4">
        {controls === "search" ? (
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Skeleton className="h-10 min-w-48 flex-1 rounded-lg" />
            <Skeleton className="h-10 rounded-lg sm:w-36" />
            <Skeleton className="h-10 rounded-lg sm:w-36" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
        )}
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="flex items-center justify-between gap-6 border-b px-4 py-3">
            {columns.map((column, i) => (
              <Skeleton key={i} className={cn(column, "h-3 max-w-16")} />
            ))}
            {action && <span className="w-8" />}
          </div>
          <div className="divide-y">
            {Array.from({ length: ROWS }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-6 px-4 py-3">
                {columns.map((column, i) => (
                  <Skeleton key={i} className={cn("h-4", column)} />
                ))}
                {action && <Skeleton className="size-8 shrink-0 rounded-lg" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
