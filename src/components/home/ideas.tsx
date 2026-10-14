import { Film, Image as ImageIcon, Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Scene, type SceneName } from "./scene";
import { SectionHeading } from "./section-heading";

// A wall of sample prompts, each over a stand-in for what it makes. On large
// screens the tiles fill a 4 × 3 grid of uneven sizes; on phones, two
// columns with the first tile full width.
const IDEAS = [
  ["1", "canal", Film, "col-span-2 row-span-2"],
  ["2", "mug", ImageIcon, ""],
  ["3", "desert", Film, ""],
  ["4", "koi", ImageIcon, "lg:row-span-2"],
  ["5", "rooftop", Mic, "col-span-2"],
  ["6", "forest", ImageIcon, "lg:row-span-2"],
] as const satisfies readonly (readonly [string, SceneName, unknown, string])[];

export function Ideas() {
  const t = useTranslations("Home.ideas");

  return (
    <section aria-labelledby="ideas" className="flex flex-col gap-10 border-t py-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading eyebrow={t("eyebrow")} id="ideas">
          {t("title")}
        </SectionHeading>
        <p className="max-w-[36ch] text-pretty text-muted-foreground">{t("body")}</p>
      </div>
      <ul className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] grid-flow-dense lg:grid-cols-4 lg:gap-4">
        {IDEAS.map(([key, scene, Icon, span]) => (
          <li
            key={key}
            className={cn(
              "group relative isolate overflow-hidden rounded-xl border transition-colors duration-150 [@media(hover:hover)]:hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_30%)]",
              span,
            )}
          >
            <Scene
              name={scene}
              className="-z-10 transition-transform duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-[1.03]"
            />
            <div className="flex h-full flex-col justify-between bg-gradient-to-t from-black/75 via-black/10 to-transparent p-3 text-white sm:p-4">
              <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
                <Icon className="size-3.5" />
                {t(`items.${key}.kind`)}
                <span className="text-white/70 tabular-nums">· {t(`items.${key}.meta`)}</span>
              </p>
              <p className="text-sm leading-5 font-medium text-pretty sm:text-base">
                {t(`items.${key}.prompt`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
