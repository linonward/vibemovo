import { Check, Gem } from "lucide-react";
import { useTranslations } from "next-intl";
import { Scene } from "./scene";

const LABEL = "font-display text-[10px] font-bold tracking-[0.13em] text-muted-foreground uppercase";

// The hero's stand-in for the product: one prompt becomes an image, and the
// image becomes a video that is still rendering (docs/DESIGN.md, Home).
// The motion loops and stops under reduced motion.
export function GenerationConsole() {
  const t = useTranslations("Home.console");

  return (
    <div className="border-glow w-full rounded-2xl">
      <figure
        aria-label={t("label")}
        className="relative w-full overflow-hidden rounded-2xl border bg-card text-left shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]"
      >
        <div className="flex h-11 items-center justify-between gap-3 border-b px-4">
          <p className="flex items-center gap-2 font-display text-xs font-semibold">
            <span aria-hidden className="size-1.5 rounded-full bg-primary-text" />
            {t("title")}
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
            <Gem className="size-3.5 text-amber-600 dark:text-amber-300" />
            {t("credits")}
          </p>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-1.5 rounded-lg border bg-background px-3 py-2.5">
            <p className={LABEL}>{t("prompt")}</p>
            <p className="text-sm leading-6">
              {t("promptText")}
              <span aria-hidden className="render-caret ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-foreground" />
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[2fr_3fr] sm:items-end">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className={LABEL}>
                  <span className="tabular-nums">01</span> {t("image")}
                </p>
                <p className="inline-flex items-center gap-1 text-xs font-medium text-primary-text">
                  <Check className="size-3.5" />
                  {t("done")}
                </p>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-lg border">
                <Scene name="canal" />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">{t("imageMeta")}</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className={LABEL}>
                  <span className="tabular-nums">02</span> {t("video")}
                </p>
                <p className="text-xs font-medium text-muted-foreground">{t("rendering")}</p>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-lg border">
                <Scene name="canal" className="scene-drift" />
                <div aria-hidden className="render-scan absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2.5 text-white">
                  <div aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                    <div className="render-progress h-full rounded-full bg-[oklch(0.77_0.15_165)]" />
                  </div>
                  <p className="font-display text-[10px] font-semibold tabular-nums">{t("time")}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">{t("videoMeta")}</p>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}
