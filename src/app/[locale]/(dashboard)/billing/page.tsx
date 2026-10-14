import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userBalance, userSubscription } from "@/app/_lib/account";
import { currentSession } from "@/app/_lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { Billing } from "@/components/billing/billing";
import { Subscription } from "@/components/billing/subscription";
import { redirect } from "@/i18n/navigation";
import { listTransactions } from "@/server/credits";
import { CREDIT_PACKS } from "@/server/payment/packs";
import { listOrders, paymentsEnabled } from "@/server/payment/orders";
import { type LiveSubscription, offeredPlans } from "@/server/payment/subscriptions";

type SearchParams = PageProps<"/[locale]/billing">["searchParams"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Billing");
  return { title: t("title") };
}

// The title is static. The rest reads the request, so it streams in behind
// this page's own Suspense: the layout's boundary doesn't cover client
// navigations between dashboard pages.
export default async function BillingPage({ searchParams }: PageProps<"/[locale]/billing">) {
  const t = await getTranslations("Billing");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BillingContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await currentSession();
  if (!session) return redirect({ href: "/sign-in", locale: await getLocale() });

  const [balance, orders, transactions, current, { checkout, pack, plan }] = await Promise.all([
    userBalance(session.user.id),
    listOrders(session.user.id),
    listTransactions(session.user.id),
    userSubscription(session.user.id),
    searchParams,
  ]);

  return (
    <Billing
      balance={balance}
      packs={CREDIT_PACKS}
      orders={orders}
      transactions={transactions}
      enabled={paymentsEnabled("packs")}
      checkout={checkout === "success" || checkout === "cancel" ? checkout : undefined}
      // The pricing page links here with the pack or plan the visitor chose.
      selected={typeof pack === "string" ? pack : undefined}
      subscription={
        <Subscription
          plans={offeredPlans()}
          // Only what the card shows: the row also has provider IDs.
          current={current && pick(current)}
          enabled={paymentsEnabled("subscriptions")}
          selected={typeof plan === "string" ? plan : undefined}
        />
      }
    />
  );
}

function pick({ interval, credits, amount, currency, status, currentPeriodEnd }: LiveSubscription) {
  return { interval, credits, amount, currency, status, currentPeriodEnd };
}
