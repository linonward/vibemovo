import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "@/components/home/section-heading";
import { Link } from "@/i18n/navigation";
import { EFFECT_PAGES, type EffectPageKind } from "@/lib/effect-pages";

// The end of each landing page: links to the other effects' pages, then the
// locale's related guides, so every landing page reaches every other.
export function MoreEffects({
  current,
  related = [],
}: {
  current: EffectPageKind;
  related?: { href: string; title: string }[];
}) {
  const t = useTranslations("MoreEffects");
  const items = [
    ...EFFECT_PAGES.filter((page) => page.kind !== current).map((page) => ({
      href: page.path,
      title: t(`${page.kind}.title`),
      body: t(`${page.kind}.body`),
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
