import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

const videosDir = path.join(process.cwd(), "outputs", "videos");
const SAFE_NAME = /^[a-f0-9-]+\.mov$/i;

export async function GET(request, { params }) {
  const { filename } = await params;
  if (!SAFE_NAME.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(videosDir, filename);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = statSync(filePath);
  const stream = Readable.toWeb(createReadStream(filePath));
  return new NextResponse(stream, {
    headers: {
      "content-type": "video/quicktime",
      "content-length": String(stat.size),
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
