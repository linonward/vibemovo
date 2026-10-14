import { AtSign, Gem, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "./section-heading";

// One panel, one column per step (docs/DESIGN.md, Step strip).
const STEPS = [
  ["1", AtSign, "bg-primary-text/12 text-primary-text"],
  ["2", Gem, "bg-amber-400/12 text-amber-600 dark:text-amber-300"],
  ["3", Sparkles, "bg-cyan-400/12 text-cyan-700 dark:text-cyan-300"],
] as const;

export function HowItWorks() {
  const t = useTranslations("Home.steps");

  return (
    <section aria-labelledby="how-it-works" className="flex scroll-mt-20 flex-col gap-12 border-t py-20">
      <SectionHeading eyebrow={t("eyebrow")} id="how-it-works" center>
        {t("title")}
      </SectionHeading>
      <ol className="grid divide-y rounded-2xl border bg-card md:grid-cols-3 md:divide-x md:divide-y-0">
        {STEPS.map(([key, Icon, tint]) => (
          <li key={key} className="flex flex-col gap-3 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className={`flex size-10 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="size-5" />
              </span>
              <span className="font-display text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase tabular-nums">
                {t("step", { n: key })}
              </span>
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold">{t(`items.${key}.title`)}</h3>
            <p className="text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
