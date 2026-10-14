import { ChevronDown, Search } from "lucide-react";
import type { ComponentProps } from "react";
import Form from "next/form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { ORDER_PROVIDERS, ORDER_STATUSES, type OrderRow } from "./order-table";

// The native arrow sits against the edge and differs per browser; draw our
// own chevron so it matches the other icons.
function FilterSelect({ children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className="h-10 w-full appearance-none rounded-lg border border-input bg-card pr-9 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// A GET form, like the user search: filters land in the URL, so a view can
// be linked and works without JavaScript. Submitting starts on page 1.
export function OrderFilters({
  action,
  query,
  status,
  provider,
}: {
  action: string;
  query: string;
  status?: OrderRow["status"];
  provider?: OrderRow["provider"];
}) {
  const t = useTranslations("Admin");

  return (
    <Form action={action} role="search" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          aria-label={t("orders.searchLabel")}
          placeholder={t("orders.searchPlaceholder")}
          className="pl-9"
        />
      </div>
      <FilterSelect name="status" defaultValue={status ?? ""} aria-label={t("orders.status")}>
        <option value="">{t("orders.allStatuses")}</option>
        {ORDER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {t(`orders.statuses.${value}`)}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect name="provider" defaultValue={provider ?? ""} aria-label={t("orders.provider")}>
        <option value="">{t("orders.allProviders")}</option>
        {ORDER_PROVIDERS.map((value) => (
          <option key={value} value={value}>
            {t(`orders.providers.${value}`)}
          </option>
        ))}
      </FilterSelect>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" className="h-10">
          {t("orders.filter")}
        </Button>
        {(query || status || provider) && (
          <Link
            href="/admin/orders"
            className="text-sm text-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
          >
            {t("orders.clear")}
          </Link>
        )}
      </div>
    </Form>
  );
}
