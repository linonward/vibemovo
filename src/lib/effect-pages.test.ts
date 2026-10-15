import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";
import { EFFECT_PAGES, effectPoster } from "./effect-pages";

const root = join(__dirname, "../..");

test("paths and kinds are unique", () => {
  expect(new Set(EFFECT_PAGES.map((page) => page.path)).size).toBe(EFFECT_PAGES.length);
  expect(new Set(EFFECT_PAGES.map((page) => page.kind)).size).toBe(EFFECT_PAGES.length);
});

test.each(EFFECT_PAGES)("$path has a page route", ({ path }) => {
  expect(existsSync(join(root, "src/app/[locale]/(marketing)", path, "page.tsx"))).toBe(true);
});

test.each(EFFECT_PAGES)("$kind has a real sample and poster", ({ kind }) => {
  expect(existsSync(join(root, "public", effectPoster(kind)))).toBe(true);
  expect(existsSync(join(root, "public/landing", kind, "sample.mp4"))).toBe(true);
});

test.each(EFFECT_PAGES)("$kind has en and zh copy for every link", ({ kind, namespace }) => {
  for (const messages of [en, zh]) {
    const copy = messages[namespace];
    for (const text of [copy.nav, copy.title, copy.description, copy.hero.eyebrow, copy.hero.points["1"]]) {
      expect(text).toBeTruthy();
    }
    expect(messages.MoreEffects[kind].title).toBeTruthy();
    expect(messages.MoreEffects[kind].body).toBeTruthy();
  }
});
