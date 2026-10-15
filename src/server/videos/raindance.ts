// The raindance duo, after the "Raindance" AI trend: two reference photos
// become a 15-second vertical video of the trend's dock scene. One person
// waits at the end of a wooden dock over the sea at golden hour; the other
// walks up singing to them; then the two sit side by side at sunset. No
// names and no lines, so nothing is written per video.

// Wan 3.0 calls the reference images 图1 and 图2, in the order sent. Each
// beat pins the camera: the model zooms otherwise. The song is the model's
// own wordless melody: never the trend's real song, its artists or lyrics,
// which users add themselves when they post.
export function raindancePrompt(): string {
  return `Vertical 9:16 cinematic music video in three beats.
图1 waits at the end of the dock. 图2 is the singer. Keep each person's face shape, hairstyle, body shape and outfit from their reference image for the entire clip.

Beat one, 0 to 5 seconds, static wide shot from the shore end of the dock, no zoom: a long weathered wooden dock over calm turquoise sea at golden hour, low warm sun near the horizon, gentle waves. 图1 sits at the far end of the dock, legs over the water, looking out to sea. 图2 walks slowly along the dock toward 图1, singing, one hand on their chest.

Beat two, 5 to 10 seconds, slow push-in to a medium close-up of 图2: 图2 stops a few steps behind 图1 and sings to them with feeling, eyes closed, then open and fixed on 图1. 图1 turns around, surprised, then smiles.

Beat three, 10 to 15 seconds, hard cut to a static shot from behind the two: both sit side by side at the end of the dock, silhouetted against the setting sun over the sea. 图2 sways and keeps singing; 图1 sways along.

(a warm, mellow Afrobeats-tinged R&B groove with soft guitar, light percussion and a deep bass, playing from the first frame to the last)
<图2 sings a soft, soulful wordless melody, only oohs and hums, no words; gentle waves against the dock; a faint creak of wooden boards>

Style: photorealistic, natural skin texture, sharp focus, 35mm film look, warm golden grade, soft lens flare. A heartfelt music-video moment between two people.
No text, no subtitles, no logos, no extra people, the two never swap faces.`;
}
