import { getCloudflareContext } from "@opennextjs/cloudflare";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api.js";
import { generationPrompts } from "../../../lib/generation-prompts.js";
import { storeGeneratedMedia } from "../../../lib/media-storage.js";
import { validateImageUpload } from "../../../lib/openai-images.js";
import { generateSoraVideo } from "../../../lib/openai-video.js";
import { processVideo, requireContentLength } from "../../../lib/video-processor.js";

export const maxDuration = 300;

const VIDEO_SIZE = { width: 1280, height: 720 };

export async function POST(request) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const form = await request.formData();
    const sceneImage = form.get("image");
    validateImageUpload(sceneImage);

    const { env } = await getCloudflareContext({ async: true });
    const paddedResponse = await processVideo({
      binding: env.VIDEO_PROCESSOR,
      operation: "pad-frame",
      bytes: sceneImage,
      contentType: sceneImage.type,
      width: VIDEO_SIZE.width,
      height: VIDEO_SIZE.height,
    });

    const paddedFrame = await paddedResponse.blob();
    const rawVideo = await generateSoraVideo({
      apiKey: process.env.OPENAI_API_KEY,
      image: paddedFrame,
      prompt: generationPrompts.video,
      size: `${VIDEO_SIZE.width}x${VIDEO_SIZE.height}`,
      seconds: "4",
    });
    const alphaResponse = await processVideo({
      binding: env.VIDEO_PROCESSOR,
      operation: "chroma-key",
      bytes: rawVideo,
      contentType: "video/mp4",
    });
    const alphaSize = await requireContentLength(alphaResponse);

    const stored = await storeGeneratedMedia({
      bucket: env.MEDIA_BUCKET,
      bytes: alphaResponse.body,
      size: alphaSize,
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
  }
}
