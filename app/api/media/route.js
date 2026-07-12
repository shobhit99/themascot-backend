import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api.js";

export async function GET() {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const records = await fetchQuery(api.media.listMine, {}, { token });
  const media = records.map((record) => {
    const baseUrl = `/api/media/${record._id}`;
    return {
      id: record._id,
      kind: record.kind,
      contentType: record.contentType,
      size: record.size,
      createdAt: record.createdAt,
      url: record.kind === "video" && record.previewObjectKey
        ? `${baseUrl}?variant=preview`
        : baseUrl,
      downloadUrl: `${baseUrl}?download=1`,
    };
  });

  return NextResponse.json(
    { media },
    { headers: { "cache-control": "private, no-store" } },
  );
}
