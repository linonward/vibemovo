import { useTranslations } from "next-intl";
import Image from "next/image";
import { cn } from "cn";
import { Link } from "@/i18n/navigation";

const LABEL = "font-display text-[10px] font-bold tracking-[0.13em] text-muted-foreground uppercase";

// The template that plays leads the list; the rest follow the home
// templates section's order.
const TEMPLATES = [
  ["ZombieLanding", "/ai-zombie-couple-video", "/landing/zombie/poster.jpg"],
  ["RapLanding", "/ai-rap-video-generator", "/landing/rap/poster.jpg"],
  ["HugLanding", "/hug-your-younger-self-ai", "/landing/hug/poster.jpg"],
  ["VampireLanding", "/ai-vampire-transformation-video", "/landing/vampire/poster.jpg"],
] as const;

// The hero's showcase (docs/DESIGN.md, Home): a real zombie couple result
// plays beside the list of templates, each linking its public page. The
// video has controls, so it can be paused.
export function TemplateShowcase() {
  const t = useTranslations("Home.showcase");
  const zombie = useTranslations("ZombieLanding");

  return (
    <div className="border-glow w-full rounded-2xl">
      <figure
        aria-label={t("label")}
        className="relative w-full overflow-hidden rounded-2xl border bg-card text-left shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]"
      >
        <div className="flex h-11 items-center justify-between gap-3 border-b px-4">
          <p className="flex items-center gap-2 font-display text-xs font-semibold">
            <span aria-hidden className="size-1.5 rounded-full bg-primary-text" />
            {zombie("hero.eyebrow")}
          </p>
          <p className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">{t("photos")}</p>
        </div>

        <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-4 p-4 sm:gap-5 sm:p-5">
          <video
            src="/landing/zombie/sample.mp4"
            poster="/landing/zombie/poster.jpg"
            aria-label={zombie("result.video")}
            width={540}
            height={960}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="w-full rounded-lg border bg-muted"
          />
          <div className="flex flex-col gap-2">
            <p className={LABEL}>{t("list")}</p>
            <ul className="flex flex-col gap-1.5">
              {TEMPLATES.map((template, i) => (
                <TemplateRow key={template[0]} template={template} playing={i === 0} />
              ))}
            </ul>
          </div>
        </div>
      </figure>
    </div>
  );
}

function TemplateRow({
  template: [namespace, href, poster],
  playing,
}: {
  template: (typeof TEMPLATES)[number];
  playing: boolean;
}) {
  const t = useTranslations(namespace);
  const showcase = useTranslations("Home.showcase");

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg border p-2 transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]",
          playing ? "border-primary-text/60 bg-muted/60" : "border-transparent",
        )}
      >
        <Image src={poster} alt="" width={40} height={40} className="hidden size-10 shrink-0 rounded-md object-cover sm:block" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm leading-5 font-semibold text-pretty break-keep">{t("nav")}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {playing ? showcase("playing") : t("hero.points.1")}
          </span>
        </span>
      </Link>
    </li>
  );
}
