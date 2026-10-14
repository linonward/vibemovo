import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { OrderFilters } from "@/components/admin/order-filters";
import { OrderTable } from "@/components/admin/order-table";
import { AdminPagination } from "@/components/admin/pagination";
import { getPathname } from "@/i18n/navigation";
import { isAdmin } from "@/server/admin/access";
import {
  listAllOrders,
  ORDER_PROVIDERS,
  ORDER_STATUSES,
  ORDERS_PAGE_SIZE,
} from "@/server/admin/orders";

type SearchParams = PageProps<"/[locale]/admin/orders">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("orders.title") };
}

// Admins only, like /admin/users: everyone else gets the 404 page, and even
// the title waits for the admin check behind this page's own Suspense.
export default function AdminOrdersPage({ searchParams }: PageProps<"/[locale]/admin/orders">) {
  return (
    <Suspense
      fallback={
        <ListSkeleton
          controls="filters"
          columns={[
            "w-48",
            "hidden w-24 sm:block",
            "w-14",
            "hidden w-14 md:block",
            "h-5 w-16",
            "hidden w-20 sm:block",
            "hidden w-28 lg:block",
          ]}
        />
      }
    >
      <AdminOrdersContent searchParams={searchParams} />
    </Suspense>
  );
}

// Unknown values are ignored rather than rejected, so a stale link still opens.
function pick<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.find((v) => v === value);
}

async function AdminOrdersContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();

  const t = await getTranslations("Admin");
  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "").trim();
  const status = pick(ORDER_STATUSES, params.status);
  const provider = pick(ORDER_PROVIDERS, params.provider);
  const page = Math.max(1, Number.parseInt(String(params.page), 10) || 1);
  const { orders, total } = await listAllOrders({ query, status, provider, page });
  const filtered = Boolean(query || status || provider);

  return (
    <>
      <PageHeader
        title={t("orders.title")}
        description={filtered ? t("orders.matches", { total }) : t("orders.count", { total })}
      />
      <div className="flex flex-col gap-4">
        <OrderFilters
          action={getPathname({ href: "/admin/orders", locale: await getLocale() })}
          query={query}
          status={status}
          provider={provider}
        />
        <OrderTable orders={orders} filtered={filtered} />
        <AdminPagination
          pathname="/admin/orders"
          params={{ q: query, status, provider }}
          page={page}
          pageCount={Math.ceil(total / ORDERS_PAGE_SIZE)}
        />
      </div>
    </>
  );
}
