// Object effects: one photo of a thing (or a pet) becomes a 5-second
// image-to-video clip with a fixed, satisfying motion. They run on the active
// video provider like any image-to-video job, so the photo is the first frame.

export const OBJECT_EFFECTS = ["squish", "inflate", "cake"] as const;

export type ObjectEffect = (typeof OBJECT_EFFECTS)[number];

// What the video list shows in place of a prompt.
export const OBJECT_EFFECT_TITLES: Record<ObjectEffect, string> = {
  squish: "Squish",
  inflate: "Inflate",
  cake: "Cake",
};

export function isObjectEffect(value: string): value is ObjectEffect {
  return (OBJECT_EFFECTS as readonly string[]).includes(value);
}

// Each pins the camera, which image-to-video models otherwise move.
const PROMPTS: Record<ObjectEffect, string> = {
  squish:
    "Static camera, no zoom. The main subject of the image turns soft like slime or a stress ball. A pair of human hands reaches in from the top and squeezes it; it squishes flat between the fingers, bulging out at the sides, then slowly springs back to its original shape. Realistic soft-body physics, satisfying, natural light. No text.",
  inflate:
    "Static camera, no zoom. The main subject of the image inflates like a balloon: it swells up evenly, turns round, smooth and slightly shiny, then lifts off the ground and floats gently upward out of the top of the frame. Playful, realistic lighting and shadows. No text.",
  cake:
    "Static camera, close-up, no zoom. A large kitchen knife enters from the side and slices cleanly through the main subject of the image, revealing that it is a realistic cake inside: soft sponge layers and cream filling. The cut slice slides slightly apart. Satisfying, realistic food detail, natural light. No text.",
};

export function objectEffectPrompt(effect: ObjectEffect): string {
  return PROMPTS[effect];
}
