"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

export type PromptExample = { label: string; prompt: string };

// Sample prompts under a prompt box. Picking one replaces the prompt.
export function PromptExamples({
  examples,
  onPick,
}: {
  examples: PromptExample[];
  onPick: (prompt: string) => void;
}) {
  const t = useTranslations("Dashboard");
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-2">
      <span id={id} className="text-sm text-muted-foreground">
        {t("examples")}
      </span>
      {examples.map((example) => (
        <button
          key={example.label}
          type="button"
          title={example.prompt}
          onClick={() => onPick(example.prompt)}
          className="rounded-full border px-2.5 py-0.5 text-xs transition-[background-color,border-color] duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          {example.label}
        </button>
      ))}
    </div>
  );
}
