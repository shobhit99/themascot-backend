import { runFfmpeg } from "./ffmpeg.js";

export function chromaKeyToProResAlpha(inputPath, outputPath) {
  return runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    "colorkey=0x009611:0.08:0.05,despill=type=green",
    "-an",
    "-c:v",
    "prores_ks",
    "-profile:v",
    "4444",
    "-pix_fmt",
    "yuva444p10le",
    outputPath,
  ]);
}
