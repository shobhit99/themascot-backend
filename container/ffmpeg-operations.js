const WIDTH = 1280;
const HEIGHT = 720;
const BACKGROUND_COLOR = "0x009611";

export function buildPadFrameArgs(inputPath, outputPath, width, height) {
  if (Number(width) !== WIDTH || Number(height) !== HEIGHT) {
    throw new Error(`Unsupported video frame dimensions: ${width}x${height}.`);
  }

  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND_COLOR}`,
    outputPath,
  ];
}

export function buildChromaKeyArgs(inputPath, outputPath) {
  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `colorkey=${BACKGROUND_COLOR}:0.08:0.05,despill=type=green`,
    "-an",
    "-c:v",
    "prores_ks",
    "-profile:v",
    "4444",
    "-pix_fmt",
    "yuva444p10le",
    outputPath,
  ];
}
