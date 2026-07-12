import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const root = path.resolve(import.meta.dirname, "..");
const suffix = crypto.randomUUID().slice(0, 8);
const image = `themascot-video-processor-test:${suffix}`;
const container = `themascot-video-processor-test-${suffix}`;

async function docker(args) {
  return execFile("docker", args, {
    cwd: root,
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function openPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The container may still be starting under architecture emulation.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Video processor container did not become healthy.");
}

async function probe(directory, fileName) {
  const { stdout } = await docker([
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "-v",
    `${directory}:/work`,
    image,
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,pix_fmt,width,height,codec_type",
    "-of",
    "json",
    `/work/${fileName}`,
  ]);
  return JSON.parse(stdout);
}

const temporaryDirectory = await realpath(
  await mkdtemp(path.join(tmpdir(), "themascot-video-container-")),
);
let containerStarted = false;

try {
  await docker([
    "buildx",
    "build",
    "--platform",
    "linux/amd64",
    "--load",
    "-t",
    image,
    "container",
  ]);

  const mount = `${temporaryDirectory}:/work`;
  await Promise.all([
    docker([
      "run", "--rm", "--platform", "linux/amd64", "-v", mount, image,
      "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=0x009611:s=64x64",
      "-frames:v", "1", "/work/source.png",
    ]),
    docker([
      "run", "--rm", "--platform", "linux/amd64", "-v", mount, image,
      "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=0x009611:s=64x64:d=0.4:r=10",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "/work/raw.mp4",
    ]),
  ]);

  const port = await openPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  await docker([
    "run", "--rm", "--platform", "linux/amd64", "-d",
    "-p", `127.0.0.1:${port}:8080`, "--name", container, image,
  ]);
  containerStarted = true;
  await waitForHealth(baseUrl);

  const [frameResponse, alphaResponse] = await Promise.all([
    fetch(`${baseUrl}/pad-frame?width=1280&height=720`, {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: await readFile(path.join(temporaryDirectory, "source.png")),
    }),
    fetch(`${baseUrl}/chroma-key`, {
      method: "POST",
      headers: { "content-type": "video/mp4" },
      body: await readFile(path.join(temporaryDirectory, "raw.mp4")),
    }),
  ]);

  assert.equal(frameResponse.status, 200, await frameResponse.text());
  assert.equal(alphaResponse.status, 200, await alphaResponse.text());
  assert.ok(Number(frameResponse.headers.get("content-length")) > 0);
  assert.ok(Number(alphaResponse.headers.get("content-length")) > 0);
  await Promise.all([
    writeFile(path.join(temporaryDirectory, "frame.png"), Buffer.from(await frameResponse.arrayBuffer())),
    writeFile(path.join(temporaryDirectory, "alpha.mov"), Buffer.from(await alphaResponse.arrayBuffer())),
  ]);

  const [frame, alpha] = await Promise.all([
    probe(temporaryDirectory, "frame.png"),
    probe(temporaryDirectory, "alpha.mov"),
  ]);
  assert.deepEqual(
    { width: frame.streams[0].width, height: frame.streams[0].height },
    { width: 1280, height: 720 },
  );
  assert.equal(alpha.streams.length, 1, "alpha output must not contain an audio stream");
  assert.equal(alpha.streams[0].codec_name, "prores");
  assert.match(alpha.streams[0].pix_fmt, /^yuva444p/);

  console.log("Container smoke test passed: 1280x720 PNG and silent ProRes alpha MOV.");
} finally {
  if (containerStarted) await docker(["stop", container]).catch(() => {});
  await rm(temporaryDirectory, { recursive: true, force: true });
}
