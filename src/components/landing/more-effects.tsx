import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "@/components/home/section-heading";
import { Link } from "@/i18n/navigation";

// Every effect's landing page, in the order the home page shows them.
const EFFECTS = [
  { kind: "rap", href: "/ai-rap-video-generator" },
  { kind: "zombie", href: "/ai-zombie-couple-video" },
  { kind: "hug", href: "/hug-your-younger-self-ai" },
  { kind: "vampire", href: "/ai-vampire-transformation-video" },
  { kind: "raindance", href: "/raindance-ai-trend" },
] as const;

export type EffectKind = (typeof EFFECTS)[number]["kind"];

// The end of each landing page: links to the other effects' pages, then the
// locale's related guides, so every landing page reaches every other.
export function MoreEffects({
  current,
  related = [],
}: {
  current: EffectKind;
  related?: { href: string; title: string }[];
}) {
  const t = useTranslations("MoreEffects");
  const items = [
    ...EFFECTS.filter((effect) => effect.kind !== current).map((effect) => ({
      href: effect.href,
      title: t(`${effect.kind}.title`),
      body: t(`${effect.kind}.body`),
    })),
    ...related.map((post) => ({ ...post, body: t("guide") })),
  ];

  return (
    <section aria-labelledby={`${current}-more`} className="flex flex-col gap-8 border-t py-20">
      <SectionHeading eyebrow={t("eyebrow")} id={`${current}-more`}>
        {t("title")}
      </SectionHeading>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
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
  );
}
