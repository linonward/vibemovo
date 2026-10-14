import { Clapperboard, Gem, ImageIcon, MessageSquare } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// KPI cards with a tinted icon tile each (docs/DESIGN.md, Stat card).
const CARDS = [
  { key: "credits", href: "/billing", icon: Gem, tint: "bg-primary-text/12 text-primary-text" },
  { key: "chats", href: "/chat", icon: MessageSquare, tint: "bg-cyan-400/12 text-cyan-700 dark:text-cyan-300" },
  { key: "images", href: "/images", icon: ImageIcon, tint: "bg-violet-400/12 text-violet-600 dark:text-violet-300" },
  { key: "videos", href: "/videos", icon: Clapperboard, tint: "bg-amber-400/12 text-amber-600 dark:text-amber-300" },
] as const;

type Stats = Record<(typeof CARDS)[number]["key"], number>;

export function StatCards(stats: Stats) {
  const t = useTranslations("Dashboard.stats");
  const format = useFormatter();

  return (
    <section aria-label={t("label")} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {CARDS.map(({ key, href, icon: Icon, tint }) => (
        <Link
          key={key}
          href={href}
          className="relative flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors sm:p-5 duration-150 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]"
        >
          <span className="text-[10px] font-bold tracking-[0.13em] text-muted-foreground uppercase">
            {t(`${key}.label`)}
          </span>
          <span className="text-2xl font-black sm:text-3xl tracking-[-0.025em] tabular-nums">
            {format.number(stats[key])}
          </span>
          <span className="text-[11px] text-muted-foreground">{t(`${key}.note`)}</span>
          <span
            aria-hidden
            className={`absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg sm:top-5 sm:right-5 sm:size-10 sm:rounded-xl ${tint}`}
          >
            <Icon className="size-4 sm:size-5" />
          </span>
        </Link>
      ))}
    </section>
  );
}

// Same grid while the numbers load.
export function StatCardsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {CARDS.map(({ key }) => (
        <div key={key} className="h-[98px] animate-pulse sm:h-[106px] rounded-xl border bg-primary-text/5" />
      ))}
    </div>
  );
}
