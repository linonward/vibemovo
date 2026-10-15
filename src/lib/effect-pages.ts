// Every effect's public landing page, in the order the home page shows them.
// The sitemap, llms.txt, the footer, the home templates and showcase, each
// landing page's MoreEffects and the analytics routes read this list, so a
// new page goes here once. Its copy lives under `namespace` in
// messages/*.json and under MoreEffects.<kind>; its real result in
// public/landing/<kind>/. effect-pages.test.ts checks both.
export const EFFECT_PAGES = [
  { kind: "rap", path: "/ai-rap-video-generator", namespace: "RapLanding" },
  { kind: "zombie", path: "/ai-zombie-couple-video", namespace: "ZombieLanding" },
  { kind: "hug", path: "/hug-your-younger-self-ai", namespace: "HugLanding" },
  { kind: "vampire", path: "/ai-vampire-transformation-video", namespace: "VampireLanding" },
  { kind: "raindance", path: "/raindance-ai-trend", namespace: "RaindanceLanding" },
] as const;

export type EffectPage = (typeof EFFECT_PAGES)[number];
export type EffectPageKind = EffectPage["kind"];

// A frame of the real result, for cards that link the page.
export function effectPoster(kind: EffectPageKind) {
  return `/landing/${kind}/poster.jpg`;
}
