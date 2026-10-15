import { ArrowUp, BookOpen, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { cn } from "cn";
import { Glow, SectionHeading } from "@/components/home/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ImageLimits } from "@/lib/image-limits";
import { LandingTryout } from "./landing-tryout";
import { MoreEffects } from "./more-effects";

const POINTS = ["1", "2"] as const;
const STEPS = ["1", "2", "3"] as const;
const FEATURES = ["1", "2", "3"] as const;
const QUESTIONS = ["1", "2", "3", "4"] as const;

// What the copy states about an effect, and what its form checks, from its
// server config.
export type EffectFacts = { credits: number; signup: number; maxImageBytes: number; imageLimits: ImageLimits };

// Each effect's real result: the video and four of its frames.
const LANDINGS = {
  zombie: { frames: "/blog/ai-zombie-couple-video/frames.jpg", sample: "/landing/zombie" },
  hug: { frames: "/landing/hug/frames.jpg", sample: "/landing/hug" },
  vampire: { frames: "/landing/vampire/frames.jpg", sample: "/landing/vampire" },
  raindance: { frames: "/landing/raindance/frames.jpg", sample: "/landing/raindance" },
} as const;

export type EffectLandingKind = keyof typeof LANDINGS;

// The public page for one video effect's search query: the effect's form
// right in the hero, a real result, the steps and the cost. Laid out like the rap duo's page
// (rap-landing.tsx). The copy lives under the kind's own namespace, with
// the same keys. `guide` is the locale's blog guide, if it has one; `related`
// are the locale's other guides worth a link.
export function EffectLanding({
  kind,
  facts,
  guide,
  related = [],
}: {
  kind: EffectLandingKind;
  facts: EffectFacts;
  guide?: string;
  related?: { href: string; title: string }[];
}) {
  const messages = {
    zombie: useTranslations("ZombieLanding"),
    hug: useTranslations("HugLanding"),
    vampire: useTranslations("VampireLanding"),
    raindance: useTranslations("RaindanceLanding"),
  };
  const t = messages[kind] as typeof messages.zombie;
  const { frames, sample } = LANDINGS[kind];
  const maxImageMb = facts.maxImageBytes / (1024 * 1024);

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
          kind={kind}
          credits={facts.credits}
          signup={facts.signup}
          maxImageBytes={facts.maxImageBytes}
          imageLimits={facts.imageLimits}
        />
      </section>

      <figure className="flex flex-col gap-3 pb-20">
        {/* The video is 9:16 and the frames 9:4, so 1fr and 4fr give them the same height. */}
        <div className="grid gap-3 md:grid-cols-[1fr_4fr]">
          <video
            src={`${sample}/sample.mp4`}
            poster={`${sample}/poster.jpg`}
            aria-label={t("result.video")}
            width={540}
            height={960}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="mx-auto w-full max-w-72 rounded-2xl border bg-muted md:max-w-none"
          />
          <Image src={frames} alt={t("result.alt")} width={1440} height={640} className="w-full rounded-2xl border" />
        </div>
        <figcaption className="text-sm text-muted-foreground">{t("result.caption")}</figcaption>
      </figure>

      <section aria-labelledby={`${kind}-steps`} className="flex flex-col gap-12 border-t py-20">
        <SectionHeading eyebrow={t("steps.eyebrow")} id={`${kind}-steps`}>
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
                  size: maxImageMb,
                  credits: facts.credits,
                })}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby={`${kind}-features`} className="flex flex-col gap-12 border-t py-20">
        <SectionHeading eyebrow={t("features.eyebrow")} id={`${kind}-features`}>
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

      <section
        aria-labelledby={`${kind}-faq`}
        className="grid gap-10 border-t py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
      >
        <SectionHeading eyebrow={t("faq.eyebrow")} id={`${kind}-faq`}>
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
                })}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <MoreEffects current={kind} related={related} />

      <section
        aria-labelledby={`${kind}-cta`}
        className="relative isolate mb-20 flex flex-col items-center gap-6 overflow-hidden rounded-2xl border bg-card px-6 py-16 text-center sm:px-12 sm:py-20"
      >
        <Glow className="-top-24" />
        <h2
          id={`${kind}-cta`}
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
