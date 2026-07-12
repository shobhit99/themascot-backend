import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { padToVideoFrame } from "../lib/video-frame.js";

const execFileAsync = promisify(execFile);

test("padToVideoFrame scales a square image into a 16:9 frame without cropping", async (t) => {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
  } catch {
    t.skip("ffmpeg is not installed on this machine");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "video-frame-test-"));
  const inputPath = path.join(dir, "input.png");
  const outputPath = path.join(dir, "output.png");

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x009611:s=1024x1024",
      "-frames:v",
      "1",
      inputPath,
    ]);

    await padToVideoFrame(inputPath, outputPath, 1280, 720);

    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "default=noprint_wrappers=1",
      outputPath,
    ]);
    assert.match(stdout, /width=1280/);
    assert.match(stdout, /height=720/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
