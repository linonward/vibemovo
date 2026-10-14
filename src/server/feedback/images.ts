import { MAX_FEEDBACK_IMAGE_BYTES, MAX_FEEDBACK_IMAGES } from "./config";

// Match the bytes, never the browser's filename or Content-Type.
export function feedbackImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const starts = (signature: number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return { mime: "image/png", ext: "png" };
  if (starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8)) return { mime: "image/webp", ext: "webp" };
  return null;
}

export function validImageSizes(sizes: number[]) {
  return sizes.length <= MAX_FEEDBACK_IMAGES && sizes.every((size) => size > 0)
    && sizes.reduce((total, size) => total + size, 0) <= MAX_FEEDBACK_IMAGE_BYTES;
}
