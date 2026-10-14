import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentSession } from "@/app/_lib/session";
import { redirect } from "@/i18n/navigation";
import { isAdmin } from "@/server/admin/access";

// Opens the first admin page. Non-admins get the 404 page, as on every admin page.
export default function AdminPage() {
  return (
    <Suspense>
      <AdminRedirect />
    </Suspense>
  );
}

async function AdminRedirect() {
  const session = await currentSession();
  if (!isAdmin(session?.user.email)) notFound();
  return redirect({ href: "/admin/users", locale: await getLocale() });
}
