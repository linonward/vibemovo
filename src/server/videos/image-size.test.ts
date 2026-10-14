// @vitest-environment node
import { expect, test } from "vitest";
import { checkImageSize, imageSize } from "./image-size";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)));
const u16be = (n: number) => [n >> 8, n & 0xff];
const u16le = (n: number) => [n & 0xff, n >> 8];
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, n >> 16];
const u32be = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

const png = (width: number, height: number) =>
  bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], u32be(13), "IHDR", u32be(width), u32be(height), [8, 6, 0, 0, 0]);

// SOI, an APP0 segment to skip, then a baseline SOF0 frame header.
const jpeg = (width: number, height: number, sof = 0xc0) =>
  bytes([0xff, 0xd8], [0xff, 0xe0], u16be(16), "JFIF", [0], new Array(9).fill(0), [0xff, sof], u16be(17), [8], u16be(height), u16be(width), [3]);

const riff = (chunk: string, payload: number[]) => bytes("RIFF", [0, 0, 0, 0], "WEBP", chunk, [0, 0, 0, 0], payload);

test("reads a PNG's size from its header", () => {
  expect(imageSize(png(194, 259))).toEqual({ width: 194, height: 259 });
});

test("reads a JPEG's size from its frame header, skipping other segments", () => {
  expect(imageSize(jpeg(1280, 720))).toEqual({ width: 1280, height: 720 });
  // Progressive JPEGs use SOF2.
  expect(imageSize(jpeg(640, 480, 0xc2))).toEqual({ width: 640, height: 480 });
});

test("reads lossy, lossless and extended WebP", () => {
  expect(imageSize(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(800), ...u16le(600)]))).toEqual({
    width: 800,
    height: 600,
  });
  // VP8L packs width-1 and height-1 into 14 bits each.
  const w = 300 - 1;
  const h = 200 - 1;
  const packed = w | (h << 14);
  expect(imageSize(riff("VP8L", [0x2f, packed & 0xff, (packed >> 8) & 0xff, (packed >> 16) & 0xff, packed >>> 24]))).toEqual({
    width: 300,
    height: 200,
  });
  expect(imageSize(riff("VP8X", [0, 0, 0, 0, ...u24le(1023), ...u24le(767)]))).toEqual({ width: 1024, height: 768 });
});

test("returns null for anything it can't read", () => {
  expect(imageSize(bytes("<html>"))).toBeNull();
  expect(imageSize(png(10, 10).slice(0, 20))).toBeNull();
  expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
});

const limits = { minSide: 240, maxSide: 8000, maxRatio: 2.5 };

test("checks the shortest side, the longest side and the ratio", () => {
  expect(checkImageSize({ width: 240, height: 600 }, limits)).toBe(true);
  expect(checkImageSize({ width: 194, height: 259 }, limits)).toBe(false);
  expect(checkImageSize({ width: 8001, height: 4000 }, limits)).toBe(false);
  expect(checkImageSize({ width: 1000, height: 250 }, limits)).toBe(false);
});
