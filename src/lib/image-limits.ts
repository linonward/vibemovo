// What a video provider accepts as a photo; the server checks the same
// limits (src/server/videos/image-size.ts) before it spends credits.
export type ImageLimits = { minSide: number; maxSide: number; maxRatio: number };

// Whether the picked file fits, read by the browser so a photo the provider
// would refuse never uploads. Null when the browser can't tell; the server
// still checks.
export async function fitsImageLimits(file: File, limits: ImageLimits): Promise<boolean | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const short = Math.min(bitmap.width, bitmap.height);
    const long = Math.max(bitmap.width, bitmap.height);
    bitmap.close();
    return short >= limits.minSide && long <= limits.maxSide && long / short <= limits.maxRatio;
  } catch {
    return null;
  }
}

// The values the forms' error message names.
export const limitValues = ({ minSide, maxSide, maxRatio }: ImageLimits) => ({
  min: minSide,
  max: maxSide,
  ratio: maxRatio,
});
