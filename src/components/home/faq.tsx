import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { SectionHeading } from "./section-heading";

const QUESTIONS = ["1", "2", "3", "4", "5", "6"] as const;

// Numbered rows; an open row inverts its index and toggle (docs/DESIGN.md, FAQ accordion).
export function Faq() {
  const t = useTranslations("Home.faq");

  return (
    <section
      aria-labelledby="faq"
      className="grid gap-10 border-t py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
    >
      <SectionHeading eyebrow={t("eyebrow")} id="faq">
        {t("title")}
      </SectionHeading>
      <div className="border-b">
        {QUESTIONS.map((key) => (
          <details key={key} className="group border-t open:bg-muted/40">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-2 py-4 sm:px-4 [&::-webkit-details-marker]:hidden">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold tabular-nums group-open:border-foreground group-open:bg-foreground group-open:text-background">
                {key.padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 font-display text-base font-bold sm:text-lg [@media(hover:hover)]:group-hover:text-primary-text">
                {t(`items.${key}.title`)}
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border group-open:border-foreground group-open:bg-foreground group-open:text-background">
                <Plus className="icon-turn size-4" />
              </span>
            </summary>
            <p className="max-w-[65ch] px-2 pb-6 pl-14 leading-7 text-pretty text-muted-foreground sm:px-4 sm:pl-16">
              {t.rich(`items.${key}.body`, {
                email: () => (
                  <a
                    href={`mailto:${projectConfig.supportEmail}`}
                    className="font-medium text-primary-text underline underline-offset-4"
                  >
                    {projectConfig.supportEmail}
                  </a>
                ),
              })}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
