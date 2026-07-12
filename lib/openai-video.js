const BASE_URL = "https://api.openai.com/v1";
const MODEL = "sora-2";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

// Sora always generates synchronized audio -- there is no request parameter
// to disable it (confirmed against OpenAI's Videos API guide and reference).
// Audio is stripped downstream with ffmpeg's -an instead.
export async function generateSoraVideo({
  apiKey,
  image,
  prompt,
  size = "1280x720",
  seconds = "4",
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

  const body = new FormData();
  body.set("prompt", prompt);
  body.set("model", MODEL);
  body.set("size", size);
  body.set("seconds", String(seconds));
  body.set("input_reference", image, "reference.png");

  const createResponse = await fetchImpl(`${BASE_URL}/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });
  const created = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    throw new Error(created.error?.message || `OpenAI video request failed (${createResponse.status}).`);
  }

  const videoId = created.id;
  if (!videoId) throw new Error("OpenAI response did not include a video id.");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const statusResponse = await fetchImpl(`${BASE_URL}/videos/${videoId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const status = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      throw new Error(status.error?.message || `OpenAI video status check failed (${statusResponse.status}).`);
    }

    if (status.status === "completed") {
      const contentResponse = await fetchImpl(`${BASE_URL}/videos/${videoId}/content`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!contentResponse.ok) throw new Error(`Failed to download generated video (${contentResponse.status}).`);
      return Buffer.from(await contentResponse.arrayBuffer());
    }
    if (status.status === "failed") {
      throw new Error(status.error?.message || "OpenAI video generation failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for OpenAI video generation.");
}
