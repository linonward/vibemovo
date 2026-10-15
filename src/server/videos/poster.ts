import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";

const POSTER_TIMEOUT_MS = 30_000;

// One frame of an MP4, `seconds` in, as a JPEG at the video's own size.
// The MP4 goes through a temporary file: its index can sit at the end, so
// ffmpeg needs to seek. Throws if ffmpeg fails or the video is shorter.
export async function posterFrame(video: Uint8Array, seconds: number): Promise<Uint8Array> {
  if (!ffmpeg) throw new Error("ffmpeg-static has no binary for this platform");
  const dir = await mkdtemp(join(tmpdir(), "poster-"));
  try {
    const input = join(dir, "in.mp4");
    await writeFile(input, video);
    const { stdout } = await promisify(execFile)(
      ffmpeg,
      ["-v", "error", "-ss", String(seconds), "-i", input, "-frames:v", "1", "-q:v", "3", "-f", "mjpeg", "pipe:1"],
      { encoding: "buffer", timeout: POSTER_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    );
    if (stdout.length === 0) throw new Error(`No frame at ${seconds} s`);
    return new Uint8Array(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
