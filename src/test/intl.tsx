import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

const messages = { en, zh };

// Renders UI the way [locale]/layout.tsx provides it: with the locale's messages.
export function renderWithIntl(ui: ReactElement, locale: "en" | "zh" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}
