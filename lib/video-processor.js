const CONTAINER_NAME = "video-processor-0";
const ERROR_BODY_LIMIT = 2_000;

function operationUrl(operation, width, height) {
  if (operation === "chroma-key") return "http://video-processor/chroma-key";
  if (operation === "pad-frame") {
    const url = new URL("http://video-processor/pad-frame");
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    return url.toString();
  }
  throw new Error(`Unsupported video processing operation: ${operation}`);
}

export async function processVideo({
  binding,
  operation,
  bytes,
  contentType = "application/octet-stream",
  width,
  height,
}) {
  if (!binding) throw new Error("VIDEO_PROCESSOR binding is not configured.");

  const url = operationUrl(operation, width, height);
  const id = binding.idFromName(CONTAINER_NAME);
  const container = binding.get(id);
  const response = await container.fetch(
    new Request(url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes,
    }),
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, ERROR_BODY_LIMIT);
    const error = new Error(
      `Video processing failed (${response.status})${detail ? `: ${detail}` : "."}`,
    );
    error.status = 502;
    throw error;
  }

  return response;
}

export async function requireContentLength(response) {
  const header = response.headers.get("content-length");
  const value = header === null ? Number.NaN : Number(header);
  if (!Number.isSafeInteger(value) || value < 0) {
    await response.body?.cancel("Invalid video processor content length.");
    throw new Error("Video processor response did not include a valid content length.");
  }
  return value;
}
