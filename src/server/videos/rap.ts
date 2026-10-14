import { generateText, type LanguageModel } from "ai";
import { chatModel } from "@/server/ai/chat";
import { log } from "@/server/log";
import { blockedTerm } from "@/server/moderation";

// The rap duo: two reference photos and two names become a 15-second video
// where each person raps one line. A model writes the lines from the names;
// without one, or if its reply is unusable, fixed lines name them instead.

export type RapLanguage = "en" | "zh";
export type RapLines = [string, string];

// Quoted in the prompt, so a line holds no double quote.
const MAX_LINE_LENGTH = 120;
const LYRICS_TIMEOUT_MS = 20_000;
const LANGUAGES: Record<RapLanguage, string> = { en: "English", zh: "Chinese" };

// Wan 3.0 calls the reference images 图1 and 图2, in the order sent, and
// lip-syncs the quoted lines. The first sentence pins the camera: the model
// zooms otherwise.
export function rapPrompt([first, second]: RapLines): string {
  return `Static tripod camera, locked-off, centered, full-body wide shot that stays the same for the whole clip: no zoom, no push-in, no pan, no cuts.
A minimalist music studio: a seamless matte orange backdrop curving into an orange floor, soft even studio lighting, and one black vintage microphone hanging from a cable at head height exactly between the two performers.
图1 stands on the LEFT, 图2 stands on the RIGHT, with a clear gap between them. Keep each person's exact face, hairstyle, skin tone, body shape and outfit from their reference image for the entire clip.

Beat one, 0 to 7 seconds: 图1 leans toward the mic and raps with swagger, bouncing on the beat, pointing and gesturing, while 图2 nods along, sways and grins. 图1 raps: "${first}"

Beat two, 7 to 15 seconds: they switch. 图2 steps up to the mic and raps with bold hand gestures while 图1 steps back, laughs and vibes to the rhythm. 图2 raps: "${second}"

(laid-back hip-hop beat at 140 bpm with heavy 808 bass, crisp hi-hats and a catchy synth loop, playing from the first frame to the last)
<light studio room tone, sneakers tapping on the floor>

Style: photorealistic, natural skin texture, sharp focus, 35mm lens look, warm saturated orange tones. Mouths sync to the rap lines.
No text, no logos, no extra people, the two performers never swap places or faces.`;
}

export function defaultLyrics([first, second]: RapLines, language: RapLanguage): RapLines {
  return language === "zh"
    ? [`${first}站上麦克风，节奏一响就发光`, `${second}接过这一棒，我们一路唱到天亮`]
    : [`${first} on the mic, yeah we came to shine`, `${second} on the beat and we're right on time`];
}

// Two non-empty lines, each without a double quote and at most
// MAX_LINE_LENGTH characters, or null. Strips list numbering and the
// quotes models like to add.
export function parseLyrics(text: string): RapLines | null {
  const lines = text
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^\d+[.)、]\s*/, "")
        .replace(/^["“”「]+|["“”」]+$/g, "")
        .trim(),
    )
    .filter(Boolean);
  if (lines.length !== 2) return null;
  if (lines.some((line) => line.length > MAX_LINE_LENGTH || /["“”]/.test(line))) return null;
  return [lines[0], lines[1]];
}

function lyricsModel(): LanguageModel | null {
  return process.env.DEEPSEEK_API_KEY ? chatModel() : null;
}

// One line for each name, in the language. Never throws.
export async function writeLyrics(
  names: RapLines,
  language: RapLanguage,
  model: LanguageModel | null = lyricsModel(),
): Promise<RapLines> {
  if (!model) return defaultLyrics(names, language);
  try {
    const { text } = await generateText({
      model,
      system:
        "You write short, original, upbeat rap lines for a fun video. Never quote real songs. " +
        "Reply with exactly two lines and nothing else: no numbering, no quotes.",
      prompt:
        `Write two rhyming rap lines in ${LANGUAGES[language]}, each under 20 words. ` +
        `Line 1 is rapped by ${names[0]}, line 2 by ${names[1]}. Each line mentions its rapper's name.`,
      abortSignal: AbortSignal.timeout(LYRICS_TIMEOUT_MS),
    });
    const lines = parseLyrics(text);
    if (lines && !blockedTerm(lines.join("\n"))) return lines;
    log.warn("video.rap_lyrics_unusable", { reply: text.slice(0, 300) });
  } catch (error) {
    log.warn("video.rap_lyrics_failed", { error });
  }
  return defaultLyrics(names, language);
}
