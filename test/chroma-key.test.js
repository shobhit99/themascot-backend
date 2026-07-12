import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import ffmpegPath from "ffmpeg-static";

import { chromaKeyToProResAlpha } from "../lib/chroma-key.js";

const execFileAsync = promisify(execFile);
const ffmpeg = ffmpegPath || "ffmpeg";

test("chromaKeyToProResAlpha keys out the green screen and writes a ProRes 4444 alpha .mov", async (t) => {
  let ffprobeAvailable = true;
  try {
    await execFileAsync("ffprobe", ["-version"]);
  } catch {
    ffprobeAvailable = false;
  }
  if (!ffprobeAvailable) {
    t.skip("ffprobe is not installed on this machine (only used to verify the test output)");
    return;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "chroma-key-test-"));
  const inputPath = path.join(dir, "input.mp4");
  const outputPath = path.join(dir, "output.mov");

  try {
    await execFileAsync(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=0x009611:s=64x64:d=0.3:r=10", inputPath]);

    await chromaKeyToProResAlpha(inputPath, outputPath);

    assert.ok(existsSync(outputPath));
    assert.ok(statSync(outputPath).size > 0);

    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,pix_fmt",
      "-of",
      "default=noprint_wrappers=1",
      outputPath,
    ]);
    assert.match(stdout, /codec_name=prores/);
    // ProRes 4444's bitstream is always 12-bit regardless of the pix_fmt fed
    // to the encoder, so a valid alpha-carrying 4444 file reports as
    // yuva444p12le here even though we requested yuva444p10le as input.
    assert.match(stdout, /pix_fmt=yuva444p12le/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("chromaKeyToProResAlpha rejects when ffmpeg fails", async () => {
  await assert.rejects(
    chromaKeyToProResAlpha("/nonexistent/input.mp4", "/tmp/should-not-be-created.mov"),
    /ffmpeg exited with code/,
  );
});
