import { Megaphone } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

// Mirrors the broadcast table in src/server/notifications/schema.ts.
export type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  // Null for every user.
  email: string | null;
  sentBy: string;
  recipients: number;
  createdAt: Date;
};

export function BroadcastTable({ broadcasts }: { broadcasts: BroadcastRow[] }) {
  const t = useTranslations("Admin.broadcasts");
  const format = useFormatter();

  if (broadcasts.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Megaphone className="size-5" />
        </span>
        <p className="text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }

  return (
    <section>
      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("historyTitle")}</caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">{t("titleLabel")}</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("audience")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("recipients")}</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">{t("sentBy")}</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">{t("date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {broadcasts.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <p className="font-medium [overflow-wrap:anywhere]">{b.title}</p>
                  <p className="line-clamp-1 text-muted-foreground [overflow-wrap:anywhere]">{b.body}</p>
                </td>
                <td className="hidden px-4 py-3 break-all sm:table-cell">{b.email ?? t("everyone")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{format.number(b.recipients)}</td>
                <td className="hidden px-4 py-3 break-all text-muted-foreground md:table-cell">{b.sentBy}</td>
                <td className="hidden px-4 py-3 text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                  {format.dateTime(b.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
