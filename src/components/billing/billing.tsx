"use client";

import { CreditCard } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useCreditBalance } from "@/components/dashboard/credits";
import { CreditTransactions, type Transaction } from "@/components/credits/credit-transactions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAwaitCredits } from "./await-credits";
import { Chosen, CHOSEN, useRevealChoice } from "./chosen";
import { redirectFrom } from "./redirect";

type Pack = { id: string; credits: number; amount: number; currency: string };

type Order = {
  id: string;
  credits: number;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "expired" | "failed";
  createdAt: Date;
};

export type BillingProps = {
  balance: number;
  packs: readonly Pack[];
  orders: Order[];
  // The newest credit ledger rows.
  transactions: Transaction[];
  // False when no payment provider is configured.
  enabled: boolean;
  // Set when the provider sends the user back from checkout.
  checkout?: "success" | "cancel";
  // The pack ID chosen on the pricing page, if any.
  selected?: string;
  // The subscription section, shown above the packs.
  subscription?: React.ReactNode;
};

export function Billing({
  balance: initialBalance,
  packs,
  orders,
  transactions,
  enabled,
  checkout,
  selected,
  subscription,
}: BillingProps) {
  const { balance } = useCreditBalance(initialBalance);
  const t = useTranslations("Billing");
  const format = useFormatter();
  const locale = useLocale();
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const chosen = useRevealChoice();
  const credited = useAwaitCredits(checkout === "success", balance);

  // Amounts are in the currency's smallest unit; packs use two-decimal currencies.
  const price = (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });

  async function buy(packId: string) {
    setBuying(packId);
    setError(false);
    if ((await redirectFrom("/api/payment/checkout", { packId, locale })) === null) return;
    setBuying(null);
    setError(true);
  }

  return (
    <div className="flex flex-col gap-10">
      {checkout && (
        <p role="status" className="rounded-xl border bg-card px-5 py-4 text-pretty">
          {t(checkout === "cancel" ? "canceled" : credited ? "credited" : "success")}
        </p>
      )}

      <section className="flex flex-col gap-1 rounded-xl border bg-card px-5 py-4">
        <h2 className="text-sm text-muted-foreground">{t("balance")}</h2>
        <p className="font-display text-3xl font-semibold">{t("credits", { count: balance })}</p>
      </section>

      {subscription}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold">{t("buyTitle")}</h2>
        {!enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
        <ul className="grid gap-3 sm:grid-cols-3">
          {packs.map((pack) => {
            const credits = t("credits", { count: pack.credits });
            const amount = price(pack.amount, pack.currency);
            return (
              <li
                key={pack.id}
                ref={pack.id === selected ? chosen : undefined}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-5",
                  pack.id === selected && CHOSEN,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold">{credits}</h3>
                  {pack.id === selected && <Chosen />}
                </div>
                <p className="text-muted-foreground">{amount}</p>
                <Button
                  disabled={!enabled || buying !== null}
                  aria-label={t("buyLabel", { credits, price: amount })}
                  onClick={() => buy(pack.id)}
                >
                  <CreditCard />
                  {t("buy")}
                </Button>
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("checkoutError")}
          </p>
        )}
      </section>

      <CreditTransactions transactions={transactions} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold">{t("ordersTitle")}</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("ordersTitle")}</caption>
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-normal">{t("date")}</th>
                  <th className="px-5 py-3 font-normal">{t("pack")}</th>
                  <th className="px-5 py-3 font-normal">{t("amount")}</th>
                  <th className="px-5 py-3 font-normal">{t("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      {format.dateTime(order.createdAt, { dateStyle: "medium" })}
                    </td>
                    <td className="px-5 py-3">{t("credits", { count: order.credits })}</td>
                    <td className="px-5 py-3">{price(order.amount, order.currency)}</td>
                    <td className="px-5 py-3">{t(`statuses.${order.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

