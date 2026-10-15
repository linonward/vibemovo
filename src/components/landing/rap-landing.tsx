import { ArrowRight, ArrowUp, BookOpen, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Glow, SectionHeading } from "@/components/home/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ImageLimits } from "@/lib/image-limits";
import { LandingTryout } from "./landing-tryout";

const POINTS = ["1", "2"] as const;
const STEPS = ["1", "2", "3"] as const;
const FEATURES = ["1", "2", "3"] as const;
const IDEAS = ["birthday", "couple", "team", "friends"] as const;
const TIPS = ["1", "2", "3", "4"] as const;
const QUESTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

// What the copy states about the rap duo, and what its form checks, from its
// server config.
export type RapFacts = {
  credits: number;
  signup: number;
  maxImageBytes: number;
  imageLimits: ImageLimits;
  maxNameLength: number;
};

// The public page for "AI rap video generator from photos": the rap duo's
// form right in the hero, a real result, the steps and the cost. Sections follow the
// home page's (docs/DESIGN.md, Home). `guide` is the locale's blog guide,
// if it has one; `related` are the locale's other guides worth a link.
export function RapLanding({
  facts,
  guide,
  related = [],
}: {
  facts: RapFacts;
  guide?: string;
  related?: { href: string; title: string }[];
}) {
  const t = useTranslations("RapLanding");

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
      <section className="relative isolate grid items-center gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
        <Glow className="top-16 lg:left-3/4" />
        <div className="flex flex-col items-start gap-6">
          <p className="eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="display-tight font-display text-[2.25rem] leading-[1.15] font-bold text-balance break-keep sm:text-5xl sm:leading-[1.2]">
            {t("hero.title")}
          </h1>
          <p className="max-w-[46ch] text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
            {t("hero.body")}
          </p>
          {guide && (
            <Link
              href={guide}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-5 text-sm font-semibold transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
            >
              <BookOpen className="size-4" />
              {t("hero.guide")}
            </Link>
          )}
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {POINTS.map((key) => (
              <li
                key={key}
                className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
              >
                <Check aria-hidden className="size-4 text-primary-text" />
                {t(`hero.points.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <LandingTryout
          kind="rap"
          credits={facts.credits}
          signup={facts.signup}
          maxImageBytes={facts.maxImageBytes}
          imageLimits={facts.imageLimits}
          maxNameLength={facts.maxNameLength}
        />
      </section>

      <figure className="flex flex-col gap-3 pb-20">
        <video
          src="/landing/rap/sample.mp4"
          poster="/landing/rap/poster.jpg"
          aria-label={t("result.video")}
          width={960}
          height={540}
          autoPlay
          muted
          loop
          playsInline
          controls
          className="w-full rounded-2xl border bg-muted"
        />
        <figcaption className="text-sm text-muted-foreground">{t("result.caption")}</figcaption>
      </figure>

      <section aria-labelledby="rap-steps" className="flex flex-col gap-12 border-t py-20">
        <SectionHeading eyebrow={t("steps.eyebrow")} id="rap-steps">
          {t("steps.title")}
        </SectionHeading>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((key, i) => (
            <li key={key} className={cn("flex flex-col gap-3 border-t-2 pt-6", i === 0 && "border-primary-text")}>
              <span
                aria-hidden
                className={cn(
                  "font-display text-4xl font-bold tabular-nums",
                  i === 0 ? "text-primary-text" : "text-muted-foreground/60",
                )}
              >
                {key.padStart(2, "0")}
              </span>
              <h3 className="font-display text-lg font-semibold">{t(`steps.items.${key}.title`)}</h3>
              <p className="max-w-[38ch] text-pretty text-muted-foreground">
                {t(`steps.items.${key}.body`, {
                  size: facts.maxImageBytes / (1024 * 1024),
                  max: facts.maxNameLength,
                  credits: facts.credits,
                })}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="rap-features" className="flex flex-col gap-12 border-t py-20">
        <SectionHeading eyebrow={t("features.eyebrow")} id="rap-features">
          {t("features.title")}
        </SectionHeading>
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((key) => (
            <li key={key} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">{t(`features.items.${key}.title`)}</h3>
              <p className="text-pretty text-muted-foreground">{t(`features.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rap-ideas" className="flex flex-col gap-12 border-t py-20">
        <SectionHeading eyebrow={t("ideas.eyebrow")} id="rap-ideas">
          {t("ideas.title")}
        </SectionHeading>
        <ul className="grid gap-4 sm:grid-cols-2">
          {IDEAS.map((key) => (
            <li key={key} className="flex flex-col gap-2 rounded-xl border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">{t(`ideas.items.${key}.title`)}</h3>
              <p className="text-pretty text-muted-foreground">{t(`ideas.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="rap-tips"
        className="grid gap-10 border-t py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
      >
        <SectionHeading eyebrow={t("tips.eyebrow")} id="rap-tips">
          {t("tips.title")}
        </SectionHeading>
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-4">
            {TIPS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <Check aria-hidden className="mt-1 size-4 shrink-0 text-primary-text" />
                <p className="max-w-[65ch] leading-7 text-pretty text-muted-foreground">
                  <strong className="font-semibold text-foreground">{t(`tips.items.${key}.title`)}</strong>{" "}
                  {t(`tips.items.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
          {guide && (
            <Link href={guide} className="w-fit font-medium text-primary-text underline underline-offset-4">
              {t("tips.guide")}
            </Link>
          )}
        </div>
      </section>

      <section
        aria-labelledby="rap-faq"
        className="grid gap-10 border-t py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
      >
        <SectionHeading eyebrow={t("faq.eyebrow")} id="rap-faq">
          {t("faq.title")}
        </SectionHeading>
        <dl className="border-b">
          {QUESTIONS.map((key) => (
            <div key={key} className="flex flex-col gap-2 border-t px-2 py-6 sm:px-4">
              <dt className="font-display text-base font-bold sm:text-lg">{t(`faq.items.${key}.title`)}</dt>
              <dd className="max-w-[65ch] leading-7 text-pretty text-muted-foreground">
                {t.rich(`faq.items.${key}.body`, {
                  credits: facts.credits,
                  signup: facts.signup,
                  pricing: (chunks) => (
                    <Link href="/pricing" className="font-medium text-primary-text underline underline-offset-4">
                      {chunks}
                    </Link>
                  ),
                  terms: (chunks) => (
                    <Link href="/terms" className="font-medium text-primary-text underline underline-offset-4">
                      {chunks}
                    </Link>
                  ),
                })}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="rap-more" className="flex flex-col gap-8 border-t py-20">
        <SectionHeading eyebrow={t("more.eyebrow")} id="rap-more">
          {t("more.title")}
        </SectionHeading>
        <ul className="grid gap-4 md:grid-cols-2">
          {[
            { href: "/ai-zombie-couple-video", title: t("more.zombie.title"), body: t("more.zombie.body") },
            ...related.map((post) => ({ ...post, body: t("more.guide") })),
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-6 transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
              >
                <span className="flex items-center gap-2 font-display text-lg font-semibold">
                  {item.title}
                  <ArrowRight aria-hidden className="icon-nudge size-4" />
                </span>
                <span className="text-pretty text-muted-foreground">{item.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="rap-cta"
        className="relative isolate mb-20 flex flex-col items-center gap-6 overflow-hidden rounded-2xl border bg-card px-6 py-16 text-center sm:px-12 sm:py-20"
      >
        <Glow className="-top-24" />
        <h2
          id="rap-cta"
          className="display-tight font-display text-3xl leading-tight font-bold text-balance sm:text-5xl"
        >
          {t("cta.title")}
        </h2>
        <p className="text-lg text-muted-foreground">{t("cta.body")}</p>
        {/* Back up to the form; a plain anchor, as Link would add the locale. */}
        <a href="#try" className={buttonVariants({ size: "lg" })}>
          {t("cta.button")}
          <ArrowUp />
        </a>
      </section>
    </main>
  );
}
