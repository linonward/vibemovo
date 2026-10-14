import { useTranslations } from "next-intl";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";

const STEPS = ["1", "2", "3"] as const;

// A three-part timeline: a rule over each step, pine on the first
// (docs/DESIGN.md, Home).
export function HowItWorks() {
  const t = useTranslations("Home.steps");

  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-12 border-t py-20">
      <SectionHeading eyebrow={t("eyebrow")} id="how-it-works">
        {t("title")}
      </SectionHeading>
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map((key, i) => (
          <li
            key={key}
            className={cn("flex flex-col gap-3 border-t-2 pt-6", i === 0 && "border-primary-text")}
          >
            <span
              aria-hidden
              className={cn(
                "font-display text-4xl font-bold tabular-nums",
                i === 0 ? "text-primary-text" : "text-muted-foreground/60",
              )}
            >
              {key.padStart(2, "0")}
            </span>
            <h3 className="font-display text-lg font-semibold">{t(`items.${key}.title`)}</h3>
            <p className="max-w-[38ch] text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
