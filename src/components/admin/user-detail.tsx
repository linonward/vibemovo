import { ArrowLeft } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { CreditTransactions, type Transaction } from "@/components/credits/credit-transactions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Link } from "@/i18n/navigation";
import { AddCredits } from "./add-credits";

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  balance: number;
};

type Subscription = {
  credits: number;
  amount: number;
  currency: string;
  status: "active" | "canceling" | "past_due";
  currentPeriodEnd: Date | null;
};

export function UserDetail({
  user,
  subscription,
  transactions,
}: {
  user: User;
  // The subscription that is paid for or may still charge, if any.
  subscription: Subscription | null;
  transactions: Transaction[];
}) {
  const t = useTranslations("Admin");
  const tc = useTranslations("Credits");
  const format = useFormatter();
  const date = (value: Date) => format.dateTime(value, { dateStyle: "medium" });

  const fields = [
    { label: t("email"), value: <span className="break-all">{user.email}</span> },
    {
      label: t("name"),
      value: user.name || <span className="text-muted-foreground/70">{t("noName")}</span>,
    },
    { label: t("joined"), value: date(user.createdAt) },
    { label: t("verification"), value: user.emailVerified ? t("verified") : t("unverified") },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/users"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("allUsers")}
        </Link>
        <PageHeader
          title={user.name || user.email}
          description={user.name ? user.email : undefined}
        />
      </div>

      <section aria-labelledby="user-profile" className="flex flex-col gap-4">
        <h2 id="user-profile" className="font-display text-lg font-semibold">
          {t("profile")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-[auto_1fr]">
          {fields.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="-mt-2 sm:mt-0">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-card px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm text-muted-foreground">{tc("balance")}</h2>
          <p className="font-display text-3xl font-semibold">
            {tc("credits", { count: user.balance })}
          </p>
        </div>
        <AddCredits userId={user.id} email={user.email} />
      </section>

      <section aria-labelledby="user-subscription" className="flex flex-col gap-4">
        <h2 id="user-subscription" className="font-display text-lg font-semibold">
          {t("subscription")}
        </h2>
        {subscription ? (
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-5 text-sm">
            <p className="font-medium">
              {t("perMonth", { credits: subscription.credits })} ·{" "}
              {format.number(subscription.amount / 100, {
                style: "currency",
                currency: subscription.currency.toUpperCase(),
              })}
            </p>
            <p className="text-muted-foreground">{status(subscription)}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            {t("noSubscription")}
          </p>
        )}
      </section>

      <CreditTransactions transactions={transactions} />
    </>
  );

  function status({ status, currentPeriodEnd }: Subscription) {
    if (status === "past_due") return t("pastDue");
    if (!currentPeriodEnd) return t("active");
    const on = date(currentPeriodEnd);
    return status === "canceling" ? t("endsOn", { date: on }) : t("renewsOn", { date: on });
  }
}
