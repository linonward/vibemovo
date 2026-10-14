"use client";

import { ExternalLink, Repeat } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Chosen, CHOSEN, useRevealChoice } from "./chosen";
import { type Interval, IntervalToggle } from "./interval-toggle";
import { redirectFrom } from "./redirect";

// Credits are per month whatever the interval; the amount is per interval.
type Plan = { id: string; interval: Interval; credits: number; amount: number; currency: string };

type Current = {
  interval: Interval;
  credits: number;
  amount: number;
  currency: string;
  status: "active" | "canceling" | "past_due";
  currentPeriodEnd: Date | null;
};

export type SubscriptionProps = {
  plans: readonly Plan[];
  // The subscription that is paid for or may still charge, if any.
  current: Current | null;
  // False when the active provider can't sell subscriptions.
  enabled: boolean;
  // The plan ID chosen on the pricing page, if any.
  selected?: string;
};

export function Subscription({ plans, current, enabled, selected }: SubscriptionProps) {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const chosen = useRevealChoice();
  const [error, setError] = useState<"subscribeError" | "checkoutPending" | "portalError" | null>(null);
  // Monthly first, unless the pricing page chose a yearly plan.
  const [interval, setInterval] = useState<Interval>(
    plans.find((plan) => plan.id === selected)?.interval ?? "month",
  );
  // The toggle shows only when there are both monthly and yearly plans.
  const choice = new Set(plans.map((plan) => plan.interval)).size > 1;

  // Amounts are in the currency's smallest unit; plans use two-decimal currencies.
  const price = (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });
  const pricePer = (per: Interval, amount: string) =>
    t(per === "year" ? "subscription.pricePerYear" : "subscription.price", { price: amount });

  async function go(endpoint: string, body: object, failure: NonNullable<typeof error>) {
    setBusy(true);
    setError(null);
    const code = await redirectFrom(endpoint, body);
    if (code === null) return;
    setBusy(false);
    setError(code === "CHECKOUT_PENDING" ? "checkoutPending" : failure);
  }

  function statusLine({ status, currentPeriodEnd }: Current) {
    const date = currentPeriodEnd ? format.dateTime(currentPeriodEnd, { dateStyle: "medium" }) : null;
    if (status === "past_due") return t("subscription.pastDue");
    if (!date) return t("subscription.active");
    return t(status === "canceling" ? "subscription.endsOn" : "subscription.renewsOn", { date });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">{t("subscription.title")}</h2>
      {current ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5">
          <p className="font-display text-xl font-semibold">
            {t("subscription.perMonth", { credits: t("credits", { count: current.credits }) })}
          </p>
          <p className="text-muted-foreground">
            {pricePer(current.interval, price(current.amount, current.currency))}
          </p>
          <p className={current.status === "past_due" ? "text-destructive" : undefined}>
            {statusLine(current)}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => go("/api/payment/portal", { locale }, "portalError")}
          >
            <ExternalLink />
            {t("subscription.manage")}
          </Button>
        </div>
      ) : (
        <>
          {choice && <IntervalToggle value={interval} onChange={setInterval} />}
          <ul className="grid gap-3 sm:grid-cols-2">
            {plans.filter((plan) => !choice || plan.interval === interval).map((plan) => {
              const amount = price(plan.amount, plan.currency);
              return (
                <li
                  key={plan.id}
                  ref={plan.id === selected ? chosen : undefined}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border bg-card p-5",
                    plan.id === selected && CHOSEN,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold">
                      {t("subscription.perMonth", { credits: t("credits", { count: plan.credits }) })}
                    </h3>
                    {plan.id === selected && <Chosen />}
                  </div>
                  <p className="text-muted-foreground">{pricePer(plan.interval, amount)}</p>
                  <Button
                    disabled={!enabled || busy}
                    aria-label={t(
                      plan.interval === "year" ? "subscription.subscribeLabelYearly" : "subscription.subscribeLabel",
                      { price: amount },
                    )}
                    onClick={() =>
                      go("/api/payment/subscribe", { planId: plan.id, locale }, "subscribeError")
                    }
                  >
                    <Repeat />
                    {t("subscription.subscribe")}
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted-foreground">{t("subscription.note")}</p>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(
            error === "subscribeError"
              ? "checkoutError"
              : error === "checkoutPending"
                ? "subscription.checkoutPending"
                : "subscription.portalError",
          )}
        </p>
      )}
    </section>
  );
}
