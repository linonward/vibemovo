import { ArrowRight, Film, Image as ImageIcon, Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Link } from "@/i18n/navigation";
import { Scene } from "./scene";
import { SectionHeading } from "./section-heading";

// The three tools. Text to image leads with a large panel; the other two
// stack beside it (docs/DESIGN.md, Home). Tiles follow the signal order.
const TOOLS = [
  ["1", ImageIcon, "bg-primary-text/12 text-primary-text", "/images"],
  ["2", Film, "bg-amber-400/12 text-amber-600 dark:text-amber-300", "/videos"],
  ["3", Mic, "bg-violet-400/12 text-violet-600 dark:text-violet-300", "/videos/rap"],
] as const;

export function Features() {
  const t = useTranslations("Home.features");

  return (
    <section aria-labelledby="features" className="flex flex-col gap-10 border-t py-20">
      <SectionHeading eyebrow={t("eyebrow")} id="features">
        {t("title")}
      </SectionHeading>
      <ul className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {TOOLS.map((tool, i) => (
          <ToolCard key={tool[0]} tool={tool} lead={i === 0} />
        ))}
      </ul>
    </section>
  );
}

function ToolCard({ tool: [key, Icon, tint, href], lead }: { tool: (typeof TOOLS)[number]; lead: boolean }) {
  const t = useTranslations("Home.features");

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-muted/70 to-transparent p-6 transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]",
        lead && "lg:row-span-2",
      )}
    >
      {lead && (
        <div className="relative aspect-video overflow-hidden rounded-lg border lg:aspect-auto lg:min-h-48 lg:flex-1">
          <Scene name="mug" />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className={`flex size-10 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="size-5" />
        </span>
        <span className="font-display text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase tabular-nums">
          {t(`items.${key}.meta`)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-semibold">{t(`items.${key}.title`)}</h3>
        <p className="text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
      </div>
      <Link
        href={href}
        className="mt-auto inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
      >
        {t(`items.${key}.link`)}
        <ArrowRight className="icon-nudge size-4" />
      </Link>
    </li>
  );
}
