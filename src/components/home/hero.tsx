import { ArrowDown, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { GenerationConsole } from "./generation-console";
import { PrimaryLink } from "./primary-link";
import { Glow } from "./section-heading";

const POINTS = ["1", "2"] as const;

// Copy on the left, the generation console on the right; stacked on phones.
export function Hero() {
  const t = useTranslations("Home.hero");

  return (
    <section className="relative isolate grid items-center gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
      <Glow className="top-16 lg:left-3/4" />
      <div className="flex flex-col items-start gap-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary-text/60 bg-background/55 px-3 py-1 text-sm backdrop-blur-md">
          <span aria-hidden className="size-1.5 rounded-full bg-primary-text" />
          <span className="font-medium">{projectConfig.name}</span>{" "}
          <span className="text-muted-foreground">{t("eyebrow")}</span>
        </p>
        {/* The h1 leads with the query the page targets, then the tagline. */}
        <h1 className="display-tight font-display text-[2.25rem] leading-[1.15] font-bold text-balance break-keep sm:text-5xl sm:leading-[1.2]">
          <span className="block">{t("heading")}</span>{" "}
          <span className="block text-muted-foreground">{t("title")}</span>
        </h1>
        <p className="max-w-[46ch] text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
          {t("body")}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <PrimaryLink href="/sign-in">{t("cta")}</PrimaryLink>
          <a
            href="#templates"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-5 text-sm font-semibold transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
          >
            {t("secondary")}
            <ArrowDown className="size-4" />
          </a>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {POINTS.map((key) => (
            <li
              key={key}
              className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
            >
              <Check aria-hidden className="size-4 text-primary-text" />
              {t(`points.${key}`)}
            </li>
          ))}
        </ul>
      </div>
      <GenerationConsole />
    </section>
  );
}
