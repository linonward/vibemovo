// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { routing } from "./routing";

// Every locale in routing, so a new locale is checked without editing this file.
const messages: Record<string, object> = Object.fromEntries(
  routing.locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8")),
  ]),
);

// Each message as [dotted key, value], however deep it is nested.
function leaves(tree: object, prefix = ""): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]): [string, unknown][] =>
    value !== null && typeof value === "object"
      ? leaves(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

const keys = (tree: object) => leaves(tree).map(([key]) => key).sort();

const others = routing.locales.filter((locale) => locale !== routing.defaultLocale);

test.each(others)("%s has exactly the same message keys as the default locale", (locale) => {
  expect(keys(messages[locale])).toEqual(keys(messages[routing.defaultLocale]));
});

test.each(routing.locales)("no %s message is empty", (locale) => {
  const empty = leaves(messages[locale]).filter(([, value]) => typeof value !== "string" || !value.trim());
  expect(empty.map(([key]) => key)).toEqual([]);
});
