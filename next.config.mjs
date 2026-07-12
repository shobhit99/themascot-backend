import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/generate": ["./mascot-prompt.md", "./sitting.md"],
    "/api/generate-video": ["./video-generation.md", "./node_modules/ffmpeg-static/ffmpeg"],
  },
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
