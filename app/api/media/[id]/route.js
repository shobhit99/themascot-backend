import { getCloudflareContext } from "@opennextjs/cloudflare";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api.js";

function extensionFor(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "video/quicktime") return "mov";
  return "bin";
}

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return false;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return false;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return false;
  }
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, start, end };
}

export async function GET(request, { params }) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  let media;
  try {
    media = await fetchQuery(api.media.getMine, { id }, { token });
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!media) return Response.json({ error: "Not found." }, { status: 404 });

  const url = new URL(request.url);
  const wantsPreview = url.searchParams.get("variant") === "preview";
  const objectKey = wantsPreview ? media.previewObjectKey : media.objectKey;
  const contentType = wantsPreview ? media.previewContentType : media.contentType;
  if (!objectKey || !contentType) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const metadata = await env.MEDIA_BUCKET.head(objectKey);
  if (!metadata) return Response.json({ error: "Not found." }, { status: 404 });

  const range = parseRange(request.headers.get("range"), metadata.size);
  if (range === false) {
    return new Response(null, {
      status: 416,
      headers: { "content-range": `bytes */${metadata.size}` },
    });
  }

  const object = await env.MEDIA_BUCKET.get(
    objectKey,
    range ? { range: { offset: range.offset, length: range.length } } : undefined,
  );
  if (!object?.body) return Response.json({ error: "Not found." }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", contentType);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, no-store");
  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(range ? range.length : metadata.size));
  if (range) headers.set("content-range", `bytes ${range.start}-${range.end}/${metadata.size}`);
  if (url.searchParams.get("download") === "1") {
    const extension = extensionFor(contentType);
    headers.set(
      "content-disposition",
      `attachment; filename="themascot-${media.kind}-${id}.${extension}"`,
    );
  }

  return new Response(object.body, { status: range ? 206 : 200, headers });
}
