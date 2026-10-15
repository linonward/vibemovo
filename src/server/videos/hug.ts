import { RAP_DURATION } from "./config";
import type { PhotoEffect } from "./photo-effects";

// The younger-self hug, after the "hug your younger self" trend: a photo of
// the person today and one of them as a child become a 15-second vertical
// video. The adult finds the child, kneels and hugs them; then the child
// fades into light. No names and no lines, so nothing is written per video.

// Wan 3.0 calls the reference images 图1 and 图2, in the order sent. Each
// beat pins the camera: the model zooms otherwise.
export function hugPrompt(): string {
  return `Vertical 9:16 cinematic short film in three beats.
图1 is the person today, an adult. 图2 is the same person as a young child. Keep each one's face shape, hairstyle, body shape and outfit from their reference image for the entire clip, so 图2 is recognisably 图1's younger self.

Beat one, 0 to 5 seconds, static camera at child height, no zoom: a sunlit grassy park in late afternoon, golden light through the trees, dandelion seeds drifting. 图2 sits alone on the grass, playing with a small toy. 图1 walks into the frame from the side and stops a few steps away, surprised.

Beat two, 5 to 11 seconds, slow push-in on the two: 图2 looks up and studies 图1's face, then smiles and runs to them. 图1 kneels down and opens their arms, and they hug tightly. 图1 closes their eyes, smiling, with tears on their cheeks, and gently strokes 图2's hair.

Beat three, 11 to 15 seconds, the camera slowly rises above the two: 图2 dissolves into soft golden light particles inside the hug and drifts up with the dandelion seeds. 图1 stays kneeling, arms still slightly open, smiling up at the light.

(a gentle solo piano melody with soft strings that swells at the hug and fades out with the light, playing from the first frame to the last)
<birdsong, footsteps on grass, a child's soft laugh, a quiet breath>

Style: photorealistic, natural skin texture, sharp focus, 35mm film look, warm golden grade, soft lens flare. A warm family moment, not romantic.
No text, no logos, no extra people, the two never swap faces.`;
}

// Two photos: the person today, then the same person as a child.
export const hug = {
  kind: "hug",
  title: "Hug your younger self",
  photos: 2,
  duration: RAP_DURATION,
  ratio: "9:16",
  credits: 5 * RAP_DURATION,
  prompt: hugPrompt,
} as const satisfies PhotoEffect;
