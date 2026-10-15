import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { EFFECT_PAGES, type EffectPage, effectPoster } from "@/lib/effect-pages";
import { SectionHeading } from "./section-heading";

// The video templates the h1 promises, each over its real result's poster
// and linking its public page. The rap poster is 16:9 and the others 9:16;
// the 3:4 tile crops both around the people in the middle.
export function Templates() {
  const t = useTranslations("Home.templates");

  return (
    <section aria-labelledby="templates" className="flex flex-col gap-10 border-t py-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading eyebrow={t("eyebrow")} id="templates">
          {t("title")}
        </SectionHeading>
        <p className="max-w-[36ch] text-pretty text-muted-foreground">{t("body")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {EFFECT_PAGES.map((template) => (
          <TemplateCard key={template.kind} template={template} />
        ))}
      </ul>
    </section>
  );
}

function TemplateCard({
  template: { kind, path, namespace },
}: {
  template: EffectPage;
}) {
  const t = useTranslations(namespace);

  return (
    <li className="group relative isolate aspect-[3/4] overflow-hidden rounded-xl border transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_30%)]">
      <Image
        src={effectPoster(kind)}
        alt=""
        fill
        sizes="(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw"
        className="-z-10 object-cover transition-transform duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-[1.03]"
      />
      <div className="flex h-full flex-col justify-between bg-gradient-to-t from-black/75 via-black/10 to-transparent p-3 text-white sm:p-4">
        <p className="self-start rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
          {t("hero.eyebrow")}
        </p>
        <div className="flex flex-col gap-1">
          {/* The link covers the whole tile. */}
          <h3 className="font-display text-base font-semibold text-pretty break-keep sm:text-lg">
            <Link href={path} className="after:absolute after:inset-0">
              {t("nav")}
            </Link>
          </h3>
          <p className="flex items-center justify-between gap-2 text-xs text-white/75 tabular-nums sm:text-sm">
            {t("hero.points.1")}
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none [@media(hover:hover)]:group-hover:translate-x-[3px]"
            />
          </p>
        </div>
      </div>
    </li>
  );
}
