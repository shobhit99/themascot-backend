const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function validateImageUpload(image) {
  if (!image) throw new Error("Choose a photo to continue.");
  if (!SUPPORTED_TYPES.has(image.type)) {
    throw new Error("Upload a PNG, JPEG, or WebP image.");
  }
  if (image.size > MAX_IMAGE_BYTES) {
    throw new Error("The image must be 20 MB or smaller.");
  }
}

export async function generateImageEdit({
  apiKey,
  image,
  fileName,
  prompt,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

  const body = new FormData();
  body.set("model", "gpt-image-2");
  body.set("prompt", prompt);
  body.set("image", image, fileName || "reference.png");
  body.set("size", "1024x1024");
  body.set("quality", "high");
  body.set("background", "opaque");
  body.set("output_format", "png");

  const response = await fetchImpl("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error?.message || `OpenAI request failed (${response.status}).`);
  }
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error("OpenAI returned no generated image.");
  return Buffer.from(encoded, "base64");
}
