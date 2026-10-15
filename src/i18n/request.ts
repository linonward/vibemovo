import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const param = await rootParams.locale();
    if (!hasLocale(routing.locales, param)) notFound();
    locale = param;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // The server renders dates in UTC wherever it runs, so the page always
    // hydrates. LocalTimeZone (src/components/layout) then shows client
    // components' dates in the reader's own zone.
    timeZone: "UTC",
  };
});
