import { Coins } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type Transaction = { id: string; amount: number; reason: string; createdAt: Date };

// Matches the default page size of listTransactions in src/server/credits.
const PAGE_SIZE = 50;

// The credit history table, newest first. Used on /billing and in admin.
export function CreditTransactions({ transactions }: { transactions: Transaction[] }) {
  const t = useTranslations("Credits");
  const format = useFormatter();

  // Known reasons are translated; anything else shows as stored.
  const reason = (value: string) => {
    const key = `reasons.${value}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : value;
  };
  // A real minus sign, so negative amounts line up with "+".
  const signed = (amount: number) =>
    `${amount > 0 ? "+" : "−"}${format.number(Math.abs(amount))}`;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">{t("historyTitle")}</h2>
      {transactions.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Coins className="size-5" />
          </span>
          <p className="text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("historyTitle")}</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="hidden px-5 py-3 font-normal sm:table-cell">
                  {t("date")}
                </th>
                <th scope="col" className="px-4 py-3 font-normal whitespace-nowrap sm:px-5">
                  {t("reason")}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right font-normal whitespace-nowrap sm:px-5"
                >
                  {t("amount")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {transactions.map((entry) => {
                const date = format.dateTime(entry.createdAt, { dateStyle: "medium" });
                return (
                <tr key={entry.id}>
                  <td className="hidden px-5 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                    {date}
                  </td>
                  {/* Below sm the date column is hidden, so the date goes under the reason. */}
                  <td className="px-4 py-3 break-words sm:px-5">
                    {reason(entry.reason)}
                    <span aria-hidden className="block text-xs text-muted-foreground sm:hidden">
                      {date}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums sm:px-5",
                      entry.amount > 0 && "text-primary-text",
                    )}
                  >
                    {signed(entry.amount)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {transactions.length >= PAGE_SIZE && (
        <p className="text-sm text-muted-foreground">{t("limited", { count: PAGE_SIZE })}</p>
      )}
    </section>
  );
}
