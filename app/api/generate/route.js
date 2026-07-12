import { getCloudflareContext } from "@opennextjs/cloudflare";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api.js";
import { generationPrompts } from "../../../lib/generation-prompts.js";
import { storeGeneratedMedia } from "../../../lib/media-storage.js";
import { generateImageEdit, validateImageUpload } from "../../../lib/openai-images.js";

export const maxDuration = 60;

const prompts = generationPrompts;

export async function POST(request) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const form = await request.formData();
    const stage = form.get("stage");
    const image = form.get("image");
    if (stage !== "mascot" && stage !== "sitting") throw new Error("Unknown pipeline stage.");
    validateImageUpload(image);

    const output = await generateImageEdit({
      apiKey: process.env.OPENAI_API_KEY,
      image,
      fileName: image.name,
      prompt: prompts[stage],
    });

    const { env } = await getCloudflareContext({ async: true });
    const stored = await storeGeneratedMedia({
      bucket: env.MEDIA_BUCKET,
      bytes: output,
      contentType: "image/png",
      kind: stage === "mascot" ? "mascot" : "scene",
      reserveMedia: (metadata) => fetchMutation(api.media.reserve, metadata, { token }),
      finalizeMedia: (mediaId) => fetchMutation(api.media.finalize, { id: mediaId }, { token }),
      abortMedia: (mediaId) => fetchMutation(api.media.abort, { id: mediaId }, { token }),
    });

    return NextResponse.json({
      imageUrl: `/api/media/${stored.mediaId}`,
      mediaId: stored.mediaId,
      stage,
    });
  } catch (error) {
    const status = error.status || (/OPENAI_API_KEY/.test(error.message) ? 503 : 400);
    return NextResponse.json({ error: error.message }, { status });
  }
}
