import { spawn } from "node:child_process";
import ffmpegStaticPath from "ffmpeg-static";

// ffmpeg-static bundles a prebuilt binary and downloads it during npm install,
// so no system ffmpeg install is required. It resolves to null on platforms
// it doesn't ship a build for, in which case we fall back to a PATH lookup.
const FFMPEG_BIN = ffmpegStaticPath || "ffmpeg";

export function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_BIN, args);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    ffmpeg.on("error", (error) => {
      reject(new Error(`Failed to start ffmpeg: ${error.message}`));
    });
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}
