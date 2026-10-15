// The photo effects, for the UI: each kind and how many photos it takes, in
// the order the sidebar lists them. The server's definitions are
// PHOTO_EFFECTS (src/server/videos/photo-effects.ts), which the UI may not
// import; src/test/photo-effects.test.ts checks the two lists match. The form
// posts to /api/videos/<kind>, the page is /videos/<kind>, and the copy is
// PhotoEffects.kinds.<kind> in messages/*.json.
export const PHOTO_EFFECT_KINDS = {
  zombie: { photos: 2 },
  hug: { photos: 2 },
  vampire: { photos: 1 },
  raindance: { photos: 2 },
} as const satisfies Record<string, { photos: 1 | 2 }>;

export type PhotoEffectKind = keyof typeof PHOTO_EFFECT_KINDS;

export const photoEffectKinds = Object.keys(PHOTO_EFFECT_KINDS) as PhotoEffectKind[];
