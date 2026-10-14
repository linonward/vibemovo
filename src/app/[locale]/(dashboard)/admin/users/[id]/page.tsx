import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { userSubscription } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { UserDetail } from "@/components/admin/user-detail";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { isAdmin } from "@/server/admin/access";
import { getUser } from "@/server/admin/users";
import { listTransactions } from "@/server/credits";

type Params = PageProps<"/[locale]/admin/users/[id]">["params"];

// The title doesn't name the user, so it can't leak who exists.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("usersTitle") };
}

// Admins only, like /admin/users: everyone else, and unknown ids, get the
// 404 page.
export default function AdminUserPage({ params }: PageProps<"/[locale]/admin/users/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton header />}>
      <AdminUserContent params={params} />
    </Suspense>
  );
}

async function AdminUserContent({ params }: { params: Params }) {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();

  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const [subscription, transactions] = await Promise.all([
    userSubscription(id),
    listTransactions(id),
  ]);
  return <UserDetail user={user} subscription={subscription} transactions={transactions} />;
}
