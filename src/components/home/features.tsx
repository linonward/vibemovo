import { Bell, Gem, Globe, KeyRound, Scale, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "./section-heading";

// Each card gets its own tinted icon tile (docs/DESIGN.md, Signal colors).
const FEATURES = [
  ["1", KeyRound, "bg-primary-text/12 text-primary-text"],
  ["2", Gem, "bg-amber-400/12 text-amber-600 dark:text-amber-300"],
  ["3", Sparkles, "bg-violet-400/12 text-violet-600 dark:text-violet-300"],
  ["4", Bell, "bg-pink-400/12 text-pink-600 dark:text-pink-300"],
  ["5", Globe, "bg-cyan-400/12 text-cyan-700 dark:text-cyan-300"],
  ["6", Scale, "bg-primary-text/12 text-primary-text"],
] as const;

export function Features() {
  const t = useTranslations("Home.features");

  return (
    <section aria-labelledby="features" className="flex flex-col gap-12 border-t py-20">
      <SectionHeading eyebrow={t("eyebrow")} id="features" center>
        {t("title")}
      </SectionHeading>
      {/* Two rows of three on large screens. */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([key, Icon, tint]) => (
          <li
            key={key}
            className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-muted/70 to-transparent p-6 transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-lg font-semibold">{t(`items.${key}.title`)}</h3>
              <p className="text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
