import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChromaKeyArgs,
  buildPadFrameArgs,
} from "../container/ffmpeg-operations.js";

test("buildPadFrameArgs pads the complete scene into the Sora frame", () => {
  assert.deepEqual(
    buildPadFrameArgs("/tmp/source.png", "/tmp/frame.png", 1280, 720),
    [
      "-y",
      "-i",
      "/tmp/source.png",
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x009611",
      "/tmp/frame.png",
    ],
  );
});

test("buildPadFrameArgs rejects dimensions outside the fixed pipeline output", () => {
  assert.throws(
    () => buildPadFrameArgs("in", "out", 1920, 1080),
    /Unsupported video frame dimensions/,
  );
  assert.throws(
    () => buildPadFrameArgs("in", "out", "1280;rm -rf /", 720),
    /Unsupported video frame dimensions/,
  );
});

test("buildChromaKeyArgs produces silent ProRes 4444 with alpha", () => {
  assert.deepEqual(buildChromaKeyArgs("/tmp/raw.mp4", "/tmp/alpha.mov"), [
    "-y",
    "-i",
    "/tmp/raw.mp4",
    "-vf",
    "colorkey=0x009611:0.08:0.05,despill=type=green",
    "-an",
    "-c:v",
    "prores_ks",
    "-profile:v",
    "4444",
    "-pix_fmt",
    "yuva444p10le",
    "/tmp/alpha.mov",
  ]);
});
