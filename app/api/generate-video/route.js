import { getCloudflareContext } from "@opennextjs/cloudflare";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api.js";
import { chromaKeyToProResAlpha } from "../../../lib/chroma-key.js";
import { generationPrompts } from "../../../lib/generation-prompts.js";
import { storeGeneratedMedia } from "../../../lib/media-storage.js";
import { validateImageUpload } from "../../../lib/openai-images.js";
import { generateSoraVideo } from "../../../lib/openai-video.js";
import { padToVideoFrame } from "../../../lib/video-frame.js";

export const maxDuration = 300;

const VIDEO_SIZE = { width: 1280, height: 720 };

export async function POST(request) {
  const id = crypto.randomUUID();
  const sourcePath = path.join(tmpdir(), `${id}-source.png`);
  const framePath = path.join(tmpdir(), `${id}-frame.png`);
  const rawPath = path.join(tmpdir(), `${id}-raw.mp4`);
  const alphaPath = path.join(tmpdir(), `${id}-alpha.mov`);

  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const form = await request.formData();
    const sceneImage = form.get("image");
    validateImageUpload(sceneImage);

    await writeFile(sourcePath, Buffer.from(await sceneImage.arrayBuffer()));
    await padToVideoFrame(sourcePath, framePath, VIDEO_SIZE.width, VIDEO_SIZE.height);

    const paddedFrame = new Blob([await readFile(framePath)], { type: "image/png" });
    const rawVideo = await generateSoraVideo({
      apiKey: process.env.OPENAI_API_KEY,
      image: paddedFrame,
      prompt: generationPrompts.video,
      size: `${VIDEO_SIZE.width}x${VIDEO_SIZE.height}`,
      seconds: "4",
    });
    await writeFile(rawPath, rawVideo);
    await chromaKeyToProResAlpha(rawPath, alphaPath);
    const alphaVideo = await readFile(alphaPath);

    const { env } = await getCloudflareContext({ async: true });
    const stored = await storeGeneratedMedia({
      bucket: env.MEDIA_BUCKET,
      bytes: alphaVideo,
      contentType: "video/quicktime",
      kind: "video",
      previewBytes: rawVideo,
      previewContentType: "video/mp4",
      reserveMedia: (metadata) => fetchMutation(api.media.reserve, metadata, { token }),
      finalizeMedia: (mediaId) => fetchMutation(api.media.finalize, { id: mediaId }, { token }),
      abortMedia: (mediaId) => fetchMutation(api.media.abort, { id: mediaId }, { token }),
    });

    return NextResponse.json({
      mediaId: stored.mediaId,
      videoUrl: `/api/media/${stored.mediaId}?download=1`,
      previewUrl: `/api/media/${stored.mediaId}?variant=preview`,
    });
  } catch (error) {
    const status = error.status || (/OPENAI_API_KEY/.test(error.message) ? 503 : 400);
    return NextResponse.json({ error: error.message }, { status });
  } finally {
    await rm(sourcePath, { force: true });
    await rm(framePath, { force: true });
    await rm(rawPath, { force: true });
    await rm(alphaPath, { force: true });
  }
}
