import { Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AddCredits } from "./add-credits";

type User = { id: string; name: string; email: string; createdAt: Date; balance: number };

export function UserTable({ users, query = "" }: { users: User[]; query?: string }) {
  const t = useTranslations("Admin");
  const format = useFormatter();

  if (users.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Users className="size-5" />
        </span>
        <p className="text-muted-foreground">{query ? t("noMatch", { query }) : t("empty")}</p>
      </section>
    );
  }

  return (
    <section>
      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("usersTitle")}</caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">{t("email")}</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                {t("name")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{t("credits")}</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                {t("joined")}
              </th>
              <th scope="col" className="w-0 px-2 py-2.5">
                <span className="sr-only">{t("actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 break-all">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-medium underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:underline"
                  >
                    {user.email}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {user.name || <span className="text-muted-foreground/70">{t("noName")}</span>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {format.number(user.balance)}
                </td>
                <td className="hidden px-4 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                  {format.dateTime(user.createdAt, { dateStyle: "medium" })}
                </td>
                <td className="px-2 py-1.5">
                  <AddCredits userId={user.id} email={user.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
