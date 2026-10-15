import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "cn";

// Mirrors getMetrics in src/server/admin/metrics.ts; the page passes it
// straight through, so typecheck catches drift.
export type MetricsData = {
  users: { total: number; new: number };
  credits: { spent: number; refunded: number; bought: number };
  // Amounts in the currency's smallest unit.
  orders: { paid: number; revenue: { currency: string; amount: number }[] };
  generations: {
    kind: "image" | "video";
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    // Time to finish, of the jobs that succeeded. Null without any.
    medianMs: number | null;
    p95Ms: number | null;
    errors: { error: string; count: number }[];
  }[];
  // Estimated from list prices. usage is seconds of video, images, or
  // tokens in and out; costUsd is null for a model without a price.
  costs: {
    rows: {
      kind: "video" | "image" | "chat" | "lyrics";
      model: string;
      jobs: number;
      usage: number;
      credits: number;
      costUsd: number | null;
    }[];
    totalUsd: number;
  };
};

const DASH = "—";

export function MetricsView({
  metrics,
  days,
  ranges,
}: {
  metrics: MetricsData;
  days: number;
  ranges: readonly number[];
}) {
  const t = useTranslations("Admin.metrics");
  const format = useFormatter();

  // Packs use two-decimal currencies.
  const price = (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency: currency.toUpperCase() });
  const duration = (ms: number | null) => {
    if (ms === null) return DASH;
    const seconds = ms / 1000;
    const [value, unit] =
      seconds < 60 ? [seconds, "second"] : seconds < 3600 ? [seconds / 60, "minute"] : [seconds / 3600, "hour"];
    return format.number(value, { style: "unit", unit, maximumFractionDigits: 1 });
  };
  const rate = (succeeded: number, failed: number) =>
    succeeded + failed === 0 ? DASH : format.number(succeeded / (succeeded + failed), { style: "percent" });

  const { users, credits, orders, generations, costs } = metrics;
  // Cents hide what a chat call costs, so small amounts get more digits.
  const usd = (value: number | null) =>
    value === null
      ? DASH
      : format.number(value, { style: "currency", currency: "USD", maximumFractionDigits: value > 0 && value < 1 ? 4 : 2 });
  const cards = [
    { key: "newUsers", value: users.new, note: t("usersTotal", { count: users.total }) },
    { key: "spent", value: credits.spent, note: t("refunded", { count: credits.refunded }) },
    { key: "bought", value: credits.bought, note: t("boughtNote") },
    {
      key: "paidOrders",
      value: orders.paid,
      note: orders.revenue.length
        ? orders.revenue.map((r) => price(r.amount, r.currency)).join(" · ")
        : t("noRevenue"),
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label={t("range")} className="flex flex-wrap gap-2">
        {ranges.map((value) => (
          <Link
            key={value}
            href={`/admin/metrics?days=${value}`}
            aria-current={value === days ? "page" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-[background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-ring",
              value === days ? "border-foreground bg-muted" : "[@media(hover:hover)]:hover:bg-muted",
            )}
          >
            {t("days", { count: value })}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map(({ key, value, note }) => (
          <div
            key={key}
            role="group"
            aria-labelledby={`metric-${key}`}
            className="flex flex-col gap-1 rounded-xl border bg-card p-4 sm:p-5"
          >
            <span
              id={`metric-${key}`}
              className="text-[10px] font-bold tracking-[0.13em] text-muted-foreground uppercase"
            >
              {t(`cards.${key}`)}
            </span>
            <span className="text-2xl font-black tracking-[-0.025em] tabular-nums sm:text-3xl">
              {format.number(value)}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{note}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("generations")}</caption>
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("kind")}</th>
                {(["jobs", "succeeded", "failed", "pending", "successRate", "median", "p95"] as const).map((key) => (
                  <th key={key} scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    {t(`columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {generations.map((g) => (
                <tr key={g.kind}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {t(`kinds.${g.kind}`)}
                  </th>
                  {[
                    format.number(g.total),
                    format.number(g.succeeded),
                    format.number(g.failed),
                    format.number(g.pending),
                    rate(g.succeeded, g.failed),
                    duration(g.medianMs),
                    duration(g.p95Ms),
                  ].map((cell, index) => (
                    <td key={index} className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">{t("timingNote")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 id="model-costs" className="font-display text-base font-semibold">
          {t("costs.title")}
        </h2>
        {costs.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("costs.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-background">
            <table aria-labelledby="model-costs" className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">{t("kind")}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{t("costs.model")}</th>
                  {(["jobs", "usage", "credits", "cost"] as const).map((key) => (
                    <th key={key} scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                      {t(`costs.columns.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {costs.rows.map((row) => (
                  <tr key={`${row.kind} ${row.model}`}>
                    <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                      {t(`costs.kinds.${row.kind}`)}
                    </th>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{row.model}</td>
                    {[
                      format.number(row.jobs),
                      t(`costs.units.${row.kind}`, { count: row.usage }),
                      format.number(row.credits),
                      usd(row.costUsd),
                    ].map((cell, index) => (
                      <td key={index} className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <th scope="row" colSpan={5} className="px-4 py-3">
                    {t("costs.total")}
                  </th>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{usd(costs.totalUsd)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("costs.note")}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {generations.map((g) => (
          <section key={g.kind} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <h2 id={`failures-${g.kind}`} className="font-display text-base font-semibold">
              {t(`failures.${g.kind}`)}
            </h2>
            {g.errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(`noFailures.${g.kind}`)}</p>
            ) : (
              <ul aria-labelledby={`failures-${g.kind}`} className="flex flex-col divide-y text-sm">
                {g.errors.map(({ error, count }) => (
                  <li key={error} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="font-mono text-xs break-all">{error}</span>
                    <span className="tabular-nums">{format.number(count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
