// Reads an image's pixel size from its header, for the formats uploads
// accept (JPEG, PNG, WebP), so a photo a provider would refuse is turned
// away before it spends credits. Null if the header can't be read.
// JPEG EXIF rotation isn't applied; the limits below treat width and height
// alike, so a rotated photo passes or fails the same way.
export type ImageSize = { width: number; height: number };

// What a provider accepts: each side within [minSide, maxSide], and the
// longer side at most maxRatio times the shorter.
export type ImageLimits = { minSide: number; maxSide: number; maxRatio: number };

export function imageSize(bytes: Uint8Array): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const has = (length: number) => bytes.byteLength >= length;
  const ascii = (at: number, text: string) => [...text].every((c, i) => bytes[at + i] === c.charCodeAt(0));
  const size = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);

  // PNG: the IHDR chunk comes first.
  if (has(24) && bytes[0] === 0x89 && ascii(1, "PNG") && ascii(12, "IHDR")) {
    return size(view.getUint32(16), view.getUint32(20));
  }

  // JPEG: walk the segments to the first start-of-frame marker.
  if (has(4) && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 4 <= bytes.byteLength) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      // Fill bytes before a marker.
      if (marker === 0xff) {
        at++;
        continue;
      }
      // Start of scan or end of image before any frame header.
      if (marker === 0xda || marker === 0xd9) return null;
      const length = view.getUint16(at + 2);
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (at + 9 > bytes.byteLength) return null;
        return size(view.getUint16(at + 7), view.getUint16(at + 5));
      }
      at += 2 + length;
    }
    return null;
  }

  // WebP: RIFF, then one of three chunk types.
  if (has(25) && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    if (has(30) && ascii(12, "VP8 ") && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return size(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
    }
    if (ascii(12, "VP8L") && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return size((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (has(30) && ascii(12, "VP8X")) {
      const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
      return size(u24(24) + 1, u24(27) + 1);
    }
  }
  return null;
}

export function checkImageSize({ width, height }: ImageSize, limits: ImageLimits): boolean {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  return short >= limits.minSide && long <= limits.maxSide && long / short <= limits.maxRatio;
}
