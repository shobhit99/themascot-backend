import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { chromaKeyToProResAlpha } from "../../../lib/chroma-key.js";
import { validateImageUpload } from "../../../lib/openai-images.js";
import { generateSoraVideo } from "../../../lib/openai-video.js";
import { padToVideoFrame } from "../../../lib/video-frame.js";

export const maxDuration = 300;

const videoPrompt = await readFile(path.join(process.cwd(), "video-generation.md"), "utf8");
const videosDir = path.join(process.cwd(), "outputs", "videos");
const VIDEO_SIZE = { width: 1280, height: 720 };

export async function POST(request) {
  const id = crypto.randomUUID();
  const sourcePath = path.join(tmpdir(), `${id}-source.png`);
  const framePath = path.join(tmpdir(), `${id}-frame.png`);
  const rawPath = path.join(tmpdir(), `${id}-raw.mp4`);
  const alphaPath = path.join(tmpdir(), `${id}-alpha.mov`);

  try {
    const form = await request.formData();
    const sceneImage = form.get("image");
    validateImageUpload(sceneImage);

    await writeFile(sourcePath, Buffer.from(await sceneImage.arrayBuffer()));
    await padToVideoFrame(sourcePath, framePath, VIDEO_SIZE.width, VIDEO_SIZE.height);

    const paddedFrame = new Blob([await readFile(framePath)], { type: "image/png" });
    const rawVideo = await generateSoraVideo({
      apiKey: process.env.OPENAI_API_KEY,
      image: paddedFrame,
      prompt: videoPrompt,
      size: `${VIDEO_SIZE.width}x${VIDEO_SIZE.height}`,
      seconds: "4",
    });
    await writeFile(rawPath, rawVideo);
    await chromaKeyToProResAlpha(rawPath, alphaPath);

    await mkdir(videosDir, { recursive: true });
    const fileName = `${id}.mov`;
    await writeFile(path.join(videosDir, fileName), await readFile(alphaPath));

    return NextResponse.json({
      videoUrl: `/api/videos/${fileName}`,
      previewUrl: `data:video/mp4;base64,${rawVideo.toString("base64")}`,
    });
  } catch (error) {
    const status = /OPENAI_API_KEY/.test(error.message) ? 503 : 400;
    return NextResponse.json({ error: error.message }, { status });
  } finally {
    await rm(sourcePath, { force: true });
    await rm(framePath, { force: true });
    await rm(rawPath, { force: true });
    await rm(alphaPath, { force: true });
  }
}
