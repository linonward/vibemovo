import {
  CreditCard,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

const NAV = [
  ["1", LayoutDashboard],
  ["2", Users],
  ["3", CreditCard],
  ["4", Settings],
] as const;
const STATS = ["1", "2", "3"] as const;
const ROWS = ["1", "2", "3"] as const;

// Labeled HTML stand-in for a product screenshot. Replace with a real
// <Image> of your product.
export function ProductMock() {
  const t = useTranslations("Home.mock");

  return (
    <div className="border-glow w-full rounded-xl">
      <figure className="relative w-full overflow-hidden rounded-xl border bg-card text-left shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]">
        <figcaption className="absolute top-3 right-3 rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
          {t("label")}
        </figcaption>
        <div aria-hidden className="grid text-sm sm:grid-cols-[12rem_1fr]">
          <ul className="hidden flex-col gap-1 border-r bg-muted/50 p-3 sm:flex">
            {NAV.map(([key, Icon], i) => (
              <li
                key={key}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 0 ? "bg-card font-medium ring-1 ring-border" : "text-muted-foreground"}`}
              >
                <Icon className="size-4" />
                {t(`nav.${key}`)}
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
            <p className="font-display text-base font-semibold">{t("overview")}</p>
            <dl className="grid grid-cols-3 gap-3">
              {STATS.map((key) => (
                <div key={key} className="rounded-lg border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">{t(`stats.${key}.label`)}</dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {t(`stats.${key}.value`)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col">
              <p className="pb-2 text-xs text-muted-foreground">{t("activity")}</p>
              <ul className="divide-y rounded-lg border">
                {ROWS.map((key) => (
                  <li key={key} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">{t(`rows.${key}.email`)}</span>
                    <span className="hidden text-muted-foreground sm:inline">
                      {t(`rows.${key}.method`)}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{t(`rows.${key}.time`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
