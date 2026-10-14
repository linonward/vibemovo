import { Receipt } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "cn";

// Mirrors the order table in src/server/payment/schema.ts; the page passes
// rows straight through, so typecheck catches drift.
export const ORDER_STATUSES = ["pending", "paid", "expired", "failed"] as const;
export const ORDER_PROVIDERS = ["stripe", "waffo"] as const;

export type OrderRow = {
  id: string;
  userId: string;
  email: string;
  credits: number;
  // In the currency's smallest unit.
  amount: number;
  currency: string;
  status: (typeof ORDER_STATUSES)[number];
  provider: (typeof ORDER_PROVIDERS)[number];
  createdAt: Date;
};

const STATUS_CLASS: Record<OrderRow["status"], string> = {
  paid: "bg-primary-text/12 text-primary-text",
  pending: "bg-accent text-accent-foreground",
  expired: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export function OrderTable({ orders, filtered = false }: { orders: OrderRow[]; filtered?: boolean }) {
  const t = useTranslations("Admin");
  const format = useFormatter();

  if (orders.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Receipt className="size-5" />
        </span>
        <p className="text-muted-foreground">{t(filtered ? "orders.noMatch" : "orders.empty")}</p>
      </section>
    );
  }

  // Packs use two-decimal currencies.
  const price = (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });

  return (
    <section>
      <div className="overflow-hidden rounded-xl border bg-background">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("orders.title")}</caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">{t("orders.buyer")}</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                {t("orders.pack")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">{t("orders.amount")}</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                {t("orders.provider")}
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">{t("orders.status")}</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                {t("orders.date")}
              </th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
                {t("orders.id")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3 break-all">
                  <Link
                    href={`/admin/users/${order.userId}`}
                    className="font-medium underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:underline"
                  >
                    {order.email}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 whitespace-nowrap tabular-nums sm:table-cell">
                  {t("orders.credits", { count: order.credits })}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {price(order.amount, order.currency)}
                </td>
                <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground md:table-cell">
                  {t(`orders.providers.${order.provider}`)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      STATUS_CLASS[order.status],
                    )}
                  >
                    {t(`orders.statuses.${order.status}`)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                  {format.dateTime(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                  <span title={order.id}>{order.id.slice(0, 8)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
