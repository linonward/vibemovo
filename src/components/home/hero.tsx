import { ArrowDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { PrimaryLink } from "./primary-link";
import { ProductMock } from "./product-mock";
import { Glow } from "./section-heading";

export function Hero() {
  const t = useTranslations("Home.hero");

  return (
    <section className="relative isolate flex flex-col items-center gap-14 pt-16 pb-20 text-center sm:pt-24">
      <Glow className="top-8" />
      <div className="flex max-w-3xl flex-col items-center gap-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary-text/60 bg-background/55 px-3 py-1 text-sm backdrop-blur-md">
          <span aria-hidden className="size-1.5 rounded-full bg-primary-text" />
          <span className="font-medium">{projectConfig.name}</span>
          <span className="text-muted-foreground">{t("eyebrow")}</span>
        </p>
        <h1 className="display-tight font-display text-[2.25rem] leading-[1.15] font-bold text-balance sm:text-5xl sm:leading-[1.25]">
          {t("title")}
        </h1>
        <p className="max-w-[56ch] text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
          {t("body")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <PrimaryLink href="/sign-in">{t("cta")}</PrimaryLink>
          <a
            href="#how-it-works"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-5 text-sm font-semibold transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
          >
            {t("secondary")}
            <ArrowDown className="size-4" />
          </a>
        </div>
      </div>
      <ProductMock />
    </section>
  );
}
