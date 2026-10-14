"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALE_NAMES, routing, type Locale } from "@/i18n/routing";

// A menu, so it fits any number of locales.
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("current", { name: LOCALE_NAMES[locale] })}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent [@media(hover:hover)]:hover:bg-accent"
      >
        <Languages className="size-4 text-muted-foreground" />
        {/* The label names the locale; on phones the icon alone leaves room for the nav. */}
        <span className="hidden sm:inline">{LOCALE_NAMES[locale]}</span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <LocaleItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// One link per locale to the current page; also used in the account menu.
export function LocaleItems() {
  const locale = useLocale();
  const pathname = usePathname();

  return routing.locales.map((other) => (
    <DropdownMenuItem
      key={other}
      render={
        <Link
          href={pathname}
          locale={other}
          lang={other}
          aria-current={other === locale ? "true" : undefined}
        />
      }
      className="h-9 justify-between rounded-md px-2.5"
    >
      {LOCALE_NAMES[other]}
      {other === locale && <Check aria-hidden className="text-primary-text" />}
    </DropdownMenuItem>
  ));
}
