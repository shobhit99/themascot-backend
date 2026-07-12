import { runFfmpeg } from "./ffmpeg.js";

// Sora requires the input_reference image to match the target video's exact
// resolution. Our source (the sitting-scene PNG) is a 1024x1024 square, so we
// scale it to fit inside the target frame and pad the sides with the same
// chroma-green used throughout the pipeline, rather than cropping — sitting.md
// explicitly requires the full desk/legs/feet to stay visible.
const BACKGROUND_COLOR = "0x009611";

export function padToVideoFrame(inputPath, outputPath, width, height) {
  return runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND_COLOR}`,
    outputPath,
  ]);
}
