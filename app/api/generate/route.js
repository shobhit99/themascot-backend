import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import { generationPrompts } from "../../../lib/generation-prompts.js";
import { generateImageEdit, validateImageUpload } from "../../../lib/openai-images.js";
import { requireAuthenticated } from "../../../lib/require-authenticated.js";

export const maxDuration = 60;

const prompts = generationPrompts;

export async function POST(request) {
  try {
    await requireAuthenticated(isAuthenticatedNextjs);
    const form = await request.formData();
    const stage = form.get("stage");
    const image = form.get("image");
    if (!(stage in prompts)) throw new Error("Unknown pipeline stage.");
    validateImageUpload(image);

    const output = await generateImageEdit({
      apiKey: process.env.OPENAI_API_KEY,
      image,
      fileName: image.name,
      prompt: prompts[stage],
    });

    const imageUrl = `data:image/png;base64,${output.toString("base64")}`;
    return NextResponse.json({ imageUrl, stage });
  } catch (error) {
    const status = error.status || (/OPENAI_API_KEY/.test(error.message) ? 503 : 400);
    return NextResponse.json({ error: error.message }, { status });
  }
}
