import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

// Items per sidebar group, and whether the group has a label (app-sidebar.tsx).
const NAV_GROUPS = [
  { label: false, items: 1 },
  { label: true, items: 3 },
  { label: true, items: 1 },
];

// Fallback while the dashboard layout reads the session: the sidebar shell
// and a page in outline, laid out like the real thing so nothing jumps when
// it arrives. Screen readers hear the label, not the shapes. The
// [[data-sidebar-collapsed]_&] classes draw the collapsed sidebar, which
// SidebarStateScript marks on <html> before first paint.
export function ShellSkeleton() {
  const t = useTranslations("Dashboard");

  return (
    <div role="status" aria-label={t("loading")} className="flex min-h-svh w-full bg-sidebar">
      {/* Sidebar, as variant="inset" lays it out. Phones get MobileBar instead. */}
      <div
        aria-hidden
        className="hidden w-64 shrink-0 flex-col p-2 md:flex [[data-sidebar-collapsed]_&]:w-[calc(4rem+2px)]"
      >
        <div className="flex h-14 items-center justify-between px-2 [[data-sidebar-collapsed]_&]:justify-center">
          <Skeleton className="h-6 w-24 [[data-sidebar-collapsed]_&]:hidden" />
          <Skeleton className="size-6" />
        </div>
        {NAV_GROUPS.map((group, g) => (
          <div key={g} className="flex flex-col gap-1 p-2 [[data-sidebar-collapsed]_&]:px-0">
            {group.label && (
              <div className="flex h-8 items-center px-2 [[data-sidebar-collapsed]_&]:hidden">
                <Skeleton className="h-3 w-14" />
              </div>
            )}
            {Array.from({ length: group.items }, (_, i) => (
              <div
                key={i}
                className="flex h-10 items-center gap-3 px-3 [[data-sidebar-collapsed]_&]:h-8 [[data-sidebar-collapsed]_&]:justify-center [[data-sidebar-collapsed]_&]:px-0"
              >
                <Skeleton className="size-[18px] shrink-0 rounded-sm" />
                <Skeleton
                  className="h-4 [[data-sidebar-collapsed]_&]:hidden"
                  style={{ width: `${48 + (((g + i) * 23) % 40)}%` }}
                />
              </div>
            ))}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-3 p-2 [[data-sidebar-collapsed]_&]:justify-center [[data-sidebar-collapsed]_&]:px-0">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5 [[data-sidebar-collapsed]_&]:hidden">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="flex flex-1 flex-col bg-background md:m-2 md:ml-0 md:rounded-xl md:shadow-sm md:[[data-sidebar-collapsed]_&]:ml-2"
      >
        <div className="flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-6 w-24" />
        </div>
        {/* Matches the layout's page container and PageHeader. */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-48 sm:h-10" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
