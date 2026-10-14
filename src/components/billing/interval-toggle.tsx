"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

export type Interval = "month" | "year";

const INTERVALS: Interval[] = ["month", "year"];

// Switches the plans shown between monthly and yearly billing.
export function IntervalToggle({ value, onChange }: { value: Interval; onChange: (value: Interval) => void }) {
  const t = useTranslations("Billing.subscription");

  return (
    <div role="group" aria-label={t("interval")} className="flex w-fit rounded-full bg-muted p-1">
      {INTERVALS.map((interval) => (
        <button
          key={interval}
          type="button"
          onClick={() => onChange(interval)}
          aria-pressed={value === interval}
          className="rounded-full px-3.5 py-1 text-sm font-medium text-muted-foreground transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm [@media(hover:hover)]:hover:text-foreground"
        >
          {t(interval === "month" ? "monthly" : "yearly")}
        </button>
      ))}
    </div>
  );
}

// The toggle above whichever of the two plan lists it picks. For server
// components, which render both lists and can't hold the choice.
export function IntervalPlans({ month, year }: { month: ReactNode; year: ReactNode }) {
  const [interval, setInterval] = useState<Interval>("month");

  return (
    <>
      <IntervalToggle value={interval} onChange={setInterval} />
      {interval === "month" ? month : year}
    </>
  );
}
