import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { UserPagination } from "@/components/admin/user-pagination";
import { UserSearch } from "@/components/admin/user-search";
import { UserTable } from "@/components/admin/user-table";
import { getPathname } from "@/i18n/navigation";
import { isAdmin } from "@/server/admin/access";
import { listUsers, USERS_PAGE_SIZE } from "@/server/admin/users";

type SearchParams = PageProps<"/[locale]/admin/users">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("usersTitle") };
}

// Admins only (ADMIN_EMAILS). Everyone else gets the 404 page, so the
// route doesn't reveal that it exists: even the title waits for the admin
// check, behind this page's own Suspense (the layout's boundary doesn't
// cover client navigations). The status stays 200 and Next.js adds a
// noindex tag.
export default function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  return (
    <Suspense
      fallback={
        <ListSkeleton
          controls="search"
          columns={["w-56", "hidden w-28 sm:block", "w-10", "hidden w-20 sm:block"]}
          action
        />
      }
    >
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();

  const t = await getTranslations("Admin");
  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "").trim();
  const page = Math.max(1, Number.parseInt(String(params.page), 10) || 1);
  const { users, total } = await listUsers({ query, page });

  return (
    <>
      <PageHeader
        title={t("usersTitle")}
        description={query ? t("matches", { total, query }) : t("count", { total })}
      />
      <div className="flex flex-col gap-4">
        <UserSearch
          action={getPathname({ href: "/admin/users", locale: await getLocale() })}
          query={query}
        />
        <UserTable users={users} query={query} />
        <UserPagination
          page={page}
          pageCount={Math.ceil(total / USERS_PAGE_SIZE)}
          query={query}
        />
      </div>
    </>
  );
}
