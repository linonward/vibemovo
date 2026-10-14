import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
  // Pages set their own hreflang links in metadata. The proxy's Link header
  // would name every locale for every path, even a translation that doesn't
  // exist, and a different x-default.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

// Each language in its own name, for language menus. To add a locale, add it
// to `locales` and here, and add messages/<locale>.json.
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", zh: "中文" };
