// The vampire transformation, a Halloween effect: one photo becomes a
// 10-second vertical video where the person turns into a vampire in a
// candlelit hall. Nothing is written per video.

// Wan 3.0 calls the reference image 图1. Each beat pins the camera: the
// model zooms otherwise. Bailian's moderation refuses gore, so the fangs
// and eyes stay at costume level.
export function vampirePrompt(): string {
  return `Vertical 9:16 cinematic short film in three beats.
图1 is the person. Keep their face shape, hairstyle and body shape from the reference image for the entire clip, so they stay recognisable after the change.

Beat one, 0 to 4 seconds, static camera at chest height, no zoom: a gothic castle hall at night, rows of candles, tall stained-glass windows, full moon outside. 图1 stands facing the camera in their outfit from the reference image, relaxed and smiling.

Beat two, 4 to 8 seconds, slow push-in on 图1's face: lightning flashes through the windows, the candles flicker and 图1 transforms into a vampire. Their skin turns porcelain pale, their eyes glow deep red, and two small elegant fangs show as they smile. Their outfit turns into a black velvet Victorian suit with a high-collared cape lined in crimson silk. A swirl of bats circles behind them.

Beat three, 8 to 10 seconds, static camera: 图1 raises the cape across their face, then lowers it with a confident smirk as the bats fly toward the camera.

(a dramatic pipe organ chord with low strings, rising at the lightning, playing from the first frame to the last)
<thunder, flickering candle flames, fluttering bat wings, a cape swooshing>

Style: photorealistic, natural skin texture, sharp focus, 35mm film look, deep blue and candle-gold grade. Vampire look like a film costume: no blood, no wounds, no gore, no biting.
No text, no logos, no extra people.`;
}
