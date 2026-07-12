import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { generateImageEdit, validateImageUpload } from "../../../lib/openai-images.js";

export const maxDuration = 60;

const prompts = {
  mascot: await readFile(path.join(process.cwd(), "mascot-prompt.md"), "utf8"),
  sitting: await readFile(path.join(process.cwd(), "sitting.md"), "utf8"),
};

export async function POST(request) {
  try {
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
    const status = /OPENAI_API_KEY/.test(error.message) ? 503 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
