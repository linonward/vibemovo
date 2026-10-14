"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { setThemePreference, useThemePreference } from "./theme";

export const THEME_OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeSwitcher() {
  const t = useTranslations("Theme");
  const preference = useThemePreference();

  return (
    <div role="group" aria-label={t("label")} className="flex rounded-full bg-muted p-1">
      {THEME_OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setThemePreference(value)}
          aria-pressed={preference === value}
          aria-label={t(value)}
          title={t(value)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm [@media(hover:hover)]:hover:text-foreground"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
