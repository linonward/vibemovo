import { RAP_DURATION } from "./config";
import type { PhotoEffect } from "./photo-effects";

// The zombie couple, after the "zombie love story" trend: two reference
// photos become a 15-second vertical video. The survivor meets their
// partner, now a zombie, lowers the weapon and hugs them; then it cuts to a
// happy memory of the two. No names and no lines, so nothing is written per
// video.

// Wan 3.0 calls the reference images 图1 and 图2, in the order sent. Each
// beat pins the camera: the model zooms otherwise. Bailian's moderation
// refuses gore, so the zombie stays at film makeup.
export function zombiePrompt(): string {
  return `Vertical 9:16 cinematic short film in three beats.
图1 is the survivor, 图2 is the infected partner, a couple. Keep each person's face shape, hairstyle, body shape and outfit from their reference image for the entire clip, so 图2 stays recognisable as a zombie.

Beat one, 0 to 6 seconds, static camera at chest height, no zoom: an empty city street after the apocalypse at dusk, abandoned cars, drifting smoke and fog, cold blue light. 图1 stands in the foreground, tense, holding a wooden baseball bat raised. A figure staggers out of the fog toward them: it is 图2, now a zombie, with pale grey-green skin, dark veins, milky white eyes, messy hair and torn, dusty clothes from their reference outfit.

Beat two, 6 to 11 seconds, slow push-in on the two: 图1 recognises 图2, freezes, slowly lowers the bat and lets it drop to the ground. 图1 walks forward and hugs 图2 tightly. 图2 stops twitching, calms and rests their head on 图1's shoulder. Tears on 图1's face.

Beat three, 11 to 15 seconds, match cut on the hug: the same hug, months earlier, in a warm sunny kitchen with golden afternoon light. 图2 is human again, healthy and smiling, and both laugh as they hold each other.

(a soft, sad piano melody with low strings that swells at the hug and turns warm in the memory, playing from the first frame to the last)
<distant wind, the bat clattering on asphalt, a faint zombie growl that fades into quiet breathing>

Style: photorealistic, natural skin texture, sharp focus, 35mm film look, desaturated teal grade in the street and warm amber in the memory. Zombie look like film makeup: no blood, no wounds, no gore, no biting.
No text, no logos, no extra people, the two never swap faces.`;
}

// Two photos: the survivor, then the partner who turns zombie. The poster
// is cut at the hug (6 to 11 s in the prompt), not the survivor's photo.
export const zombie = {
  kind: "zombie",
  title: "Zombie couple",
  photos: 2,
  duration: RAP_DURATION,
  ratio: "9:16",
  credits: 5 * RAP_DURATION,
  posterMs: 10_000,
  prompt: zombiePrompt,
} as const satisfies PhotoEffect;
