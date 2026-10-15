import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type Interval, IntervalPlans } from "@/components/billing/interval-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Offer = { id: string; credits: number; amount: number; currency: string };
// Credits are per month whatever the interval; the amount is per interval.
type Plan = Offer & { interval: Interval };

// Credits each feature costs, so visitors can judge a pack.
export type Costs = { image: number; chat: number; videoPerSecond: number; signup: number; rap: number };

const QUESTIONS = ["expire", "failed", "refund", "cancel", "rap"] as const;

// The public price list. Buying happens on /billing, which asks a signed-out
// visitor to sign in first. Each link names the pack or plan, which billing
// marks.
export function Pricing({ plans, packs, costs }: { plans: readonly Plan[]; packs: readonly Offer[]; costs: Costs }) {
  const t = useTranslations("Pricing");
  const billing = useTranslations("Billing");
  const format = useFormatter();
  // Amounts are in the currency's smallest unit; prices use two-decimal currencies.
  const price = (offer: Offer) =>
    format.number(offer.amount / 100, { style: "currency", currency: offer.currency.toUpperCase() });
  const credits = (count: number) => billing("credits", { count });
  // The amount in display type; the period after it, smaller, so it stays on one line.
  const amount = (chunks: React.ReactNode) => (
    <span className="font-display text-2xl font-bold text-foreground tabular-nums">{chunks}</span>
  );
  const intervals = [...new Set(plans.map((plan) => plan.interval))];

  // One column of the packs' grid, so the plan lines up with the packs above it.
  const planList = (interval: Interval) => (
    <ul className="grid gap-4 sm:grid-cols-3">
      {plans
        .filter((plan) => plan.interval === interval)
        .map((plan) => {
          const yearly = plan.interval === "year";
          return (
            <li key={plan.id} className="flex flex-col gap-3 rounded-xl border border-primary-text/40 bg-primary-text/5 p-5">
              <h3 className="font-semibold">{billing("subscription.perMonth", { credits: credits(plan.credits) })}</h3>
              <p className="text-sm text-muted-foreground">
                {t.rich(yearly ? "pricePerYear" : "price", { price: price(plan), amount })}
              </p>
              <Link
                href={`/billing?plan=${plan.id}`}
                aria-label={billing(yearly ? "subscription.subscribeLabelYearly" : "subscription.subscribeLabel", {
                  price: price(plan),
                })}
                className={buttonVariants({ size: "lg" })}
              >
                {billing("subscription.subscribe")}
              </Link>
            </li>
          );
        })}
    </ul>
  );

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-5 py-12 sm:px-8 sm:py-16">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="display-tight font-display text-3xl font-bold text-balance sm:text-4xl">{t("title")}</h1>
        <p className="text-lg text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      <section aria-labelledby="pricing-packs" className="flex flex-col gap-4">
        <h2 id="pricing-packs" className="font-display text-lg font-semibold">{t("packsTitle")}</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {packs.map((pack) => (
            <li key={pack.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <h3 className="font-semibold">{credits(pack.credits)}</h3>
              <p>{amount(price(pack))}</p>
              <Link
                href={`/billing?pack=${pack.id}`}
                aria-label={billing("buyLabel", { credits: credits(pack.credits), price: price(pack) })}
                className={`${buttonVariants({ variant: "outline" })} mt-auto`}
              >
                {billing("buy")}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("packsNote")}</p>
      </section>

      <section aria-labelledby="pricing-plans" className="flex flex-col gap-4">
        <h2 id="pricing-plans" className="font-display text-lg font-semibold">{t("plansTitle")}</h2>
        {/* The toggle shows only when there are both monthly and yearly plans. */}
        {intervals.length > 1 ? (
          <IntervalPlans month={planList("month")} year={planList("year")} />
        ) : (
          planList(intervals[0])
        )}
        <p className="text-sm text-muted-foreground">{billing("subscription.note")}</p>
      </section>

      <section aria-labelledby="pricing-costs" className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
        <h2 id="pricing-costs" className="font-display text-lg font-semibold">{t("costsTitle")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            t("costs.image", { count: costs.image }),
            t("costs.chat", { count: costs.chat }),
            t("costs.video", { count: costs.videoPerSecond }),
            t("costs.signup", { count: costs.signup }),
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary-text" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pricing-faq" className="flex flex-col gap-4">
        <h2 id="pricing-faq" className="font-display text-lg font-semibold">{t("faqTitle")}</h2>
        <dl className="border-b">
          {QUESTIONS.map((key) => (
            <div key={key} className="flex flex-col gap-2 border-t py-5">
              <dt className="font-semibold">{t(`faq.${key}.title`)}</dt>
              <dd className="max-w-[65ch] leading-7 text-pretty text-muted-foreground">
                {t.rich(`faq.${key}.body`, {
                  credits: costs.rap,
                  refund: (chunks) => <BodyLink href="/refund">{chunks}</BodyLink>,
                  terms: (chunks) => <BodyLink href="/terms">{chunks}</BodyLink>,
                  rap: (chunks) => <BodyLink href="/ai-rap-video-generator">{chunks}</BodyLink>,
                })}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function BodyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary-text underline underline-offset-4">
      {children}
    </Link>
  );
}
