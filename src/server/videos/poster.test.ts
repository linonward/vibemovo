import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { afterAll, beforeAll, expect, test } from "vitest";
import { posterFrame } from "./poster";

let dir: string;
let mp4: Uint8Array;

// A 3-second 9:16 test pattern, made with the same ffmpeg.
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "poster-test-"));
  const file = join(dir, "in.mp4");
  await promisify(execFile)(ffmpeg!, [
    "-f", "lavfi", "-i", "testsrc=duration=3:size=180x320:rate=10", "-pix_fmt", "yuv420p", file,
  ]);
  mp4 = new Uint8Array(await readFile(file));
});

afterAll(() => rm(dir, { recursive: true, force: true }));

test("cuts a JPEG at the given second, at the video's size", async () => {
  const jpeg = await posterFrame(mp4, 1.5);

  expect([...jpeg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  // The SOF0 frame header holds the height, then the width.
  const sof = jpeg.findIndex((byte, i) => byte === 0xff && jpeg[i + 1] === 0xc0);
  expect((jpeg[sof + 5] << 8) | jpeg[sof + 6]).toBe(320);
  expect((jpeg[sof + 7] << 8) | jpeg[sof + 8]).toBe(180);
});

test("fails for a second past the end, and for bytes that aren't a video", async () => {
  await expect(posterFrame(mp4, 10)).rejects.toThrow();
  await expect(posterFrame(new Uint8Array([1, 2, 3]), 1)).rejects.toThrow();
});
