// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { routing } from "@/i18n/routing";
import { PHOTO_EFFECT_KINDS } from "@/lib/photo-effects";
import { RAP_DURATION } from "@/server/videos/config";
import { PHOTO_EFFECTS } from "@/server/videos/photo-effects";

// A photo effect lives in two lists: the server's definitions and the UI's
// kinds, which may not import the server. A new effect needs both, and its
// copy in every locale.

const messages = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));

test("the UI lists the server's photo effects, with the same photos, in the same order", () => {
  expect(Object.entries(PHOTO_EFFECT_KINDS)).toEqual(PHOTO_EFFECTS.map(({ kind, photos }) => [kind, { photos }]));
});

test.each(PHOTO_EFFECTS.map((effect) => [effect.kind, effect] as const))(
  "%s takes over /videos/<kind> and /api/videos/<kind> without hiding a page or a video",
  (kind) => {
    // Static folders under /videos and /api/videos win over the effect.
    expect(["rap", "effects", "library"]).not.toContain(kind);
    expect(kind).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(kind).not.toMatch(/^[0-9a-f]{8}-/);
  },
);

test.each(PHOTO_EFFECTS.map((effect) => [effect.kind, effect] as const))(
  "%s keeps a second photo only if it lasts RAP_DURATION, which expireUploads relies on",
  (_, effect) => {
    if (effect.photos === 2) expect(effect.duration).toBe(RAP_DURATION);
    expect(effect.prompt().length).toBeGreaterThan(0);
  },
);

test.each(routing.locales.flatMap((locale) => PHOTO_EFFECTS.map((effect) => [locale, effect.kind, effect] as const)))(
  "%s has copy for %s's page and each of its photos",
  (locale, kind, effect) => {
    const copy = messages(locale).PhotoEffects.kinds[kind];
    const sides = effect.photos === 2 ? ["left", "right"] : ["left"];
    expect(Object.keys(copy).sort()).toEqual(["description", "disabled", "photoHint", "title", ...sides].sort());
    for (const side of sides) expect(Object.keys(copy[side]).sort()).toEqual(["photo", "preview"]);
  },
);
