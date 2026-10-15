import { hug } from "./hug";
import { raindance } from "./raindance";
import { vampire } from "./vampire";
import { zombie } from "./zombie";

// A photo effect: one or two photos and a fixed prompt, no words from the
// user, become one Bailian Wan 3.0 video (createEffectVideo). Each effect's
// file exports its definition; list it here. POST /api/videos/<kind> and
// /videos/<kind> serve every effect in the list. The UI's list of kinds is
// PHOTO_EFFECT_KINDS (src/lib/photo-effects.ts), its copy PhotoEffects.kinds
// in messages/*.json; src/test/photo-effects.test.ts checks both.
export type PhotoEffect = {
  kind: string;
  // What the video list shows in place of a prompt.
  title: string;
  // Sent as image1 and image2, in the order the prompt's 图1 and 图2 name them.
  photos: 1 | 2;
  // Seconds. A two-photo effect must last RAP_DURATION: expireUploads finds
  // its second photo by it.
  duration: number;
  ratio: string;
  credits: number;
  // Where to cut the poster frame, in milliseconds; without it the first
  // photo is the poster.
  posterMs?: number;
  prompt: () => string;
};

export const PHOTO_EFFECTS = [zombie, hug, vampire, raindance] as const satisfies readonly PhotoEffect[];

export type PhotoEffectKind = (typeof PHOTO_EFFECTS)[number]["kind"];

export function photoEffect(kind: string): PhotoEffect | null {
  return PHOTO_EFFECTS.find((effect) => effect.kind === kind) ?? null;
}
