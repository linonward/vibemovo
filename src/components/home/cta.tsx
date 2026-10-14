import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { PrimaryLink } from "./primary-link";
import { Glow } from "./section-heading";

const POINTS = ["1", "2", "3"] as const;

// docs/DESIGN.md, Final CTA. Replace the glow with a full-bleed image or
// video of your product.
export function Cta() {
  const t = useTranslations("Home.cta");

  return (
    <section
      aria-labelledby="cta"
      className="relative isolate mb-20 flex flex-col items-center gap-6 overflow-hidden rounded-2xl border bg-card px-6 py-16 text-center sm:px-12 sm:py-20"
    >
      <Glow className="-top-24" />
      <p className="rounded-full border bg-background/55 px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase backdrop-blur-md">
        {t("eyebrow")}
      </p>
      <h2
        id="cta"
        className="display-tight font-display text-3xl leading-tight font-bold text-balance sm:text-5xl"
      >
        {t("title")}
      </h2>
      <p className="text-lg text-muted-foreground">{t("body")}</p>
      <PrimaryLink href="/sign-in">{t("button")}</PrimaryLink>
      <ul className="mt-4 flex w-full max-w-2xl flex-col items-center gap-3 border-t pt-8 sm:flex-row sm:justify-center sm:gap-8">
        {POINTS.map((key) => (
          <li
            key={key}
            className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-primary-text uppercase"
          >
            <Check aria-hidden className="size-4" />
            {t(`points.${key}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
