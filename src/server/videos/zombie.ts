// The zombie couple: two reference photos become a 15-second video where
// the couple, side by side, slowly turns into zombies and keeps dancing.
// No names and no lines, so nothing is written per video.

// Wan 3.0 calls the reference images 图1 and 图2, in the order sent. The
// first sentence pins the camera: the model zooms otherwise. Bailian's
// moderation refuses gore, so the look stays at stage makeup.
export function zombiePrompt(): string {
  return `Static tripod camera, locked-off, centered, medium-wide shot that stays the same for the whole clip: no zoom, no push-in, no pan, no cuts.
An abandoned ballroom at night: cracked marble floor, a dusty chandelier flickering overhead, thin fog rolling at ankle height, cold moonlight through tall broken windows, with a warm glow from the chandelier on the couple.
图1 stands on the LEFT, 图2 stands on the RIGHT, close together like a couple. Keep each person's face shape, hairstyle, body shape and outfit from their reference image for the entire clip, so they stay recognisable after the change.

Beat one, 0 to 5 seconds: the couple smiles at each other, holds hands and sways slowly, a sweet date night.

Beat two, 5 to 10 seconds: they both turn into zombies at the same time. Their skin fades to a pale grey-green with dark veins, their eyes cloud over to milky white, dark circles spread under the eyes, and their clothes become torn and dusty. They twitch and tilt their heads, still holding hands.

Beat three, 10 to 15 seconds: as zombies, they stagger into a clumsy slow dance, 图1 spins 图2 once, and they end leaning their foreheads together, still in love.

(a slow, eerie music-box waltz with a low cello and soft wind, playing from the first frame to the last)
<creaking floorboards, faint zombie groans, the chandelier crystals tinkling>

Style: cinematic horror-romance, photorealistic, natural skin texture, sharp focus, 35mm lens look, teal-and-amber color grade. Zombie look like film makeup: no blood, no wounds, no gore.
No text, no logos, no extra people, the two never swap places or faces.`;
}
