import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

import { buildChromaKeyArgs, buildPadFrameArgs } from "./ffmpeg-operations.js";

const PORT = Number(process.env.PORT || 8080);
const STDERR_LIMIT = 8_000;
const FFMPEG_TIMEOUT_MS = 2 * 60 * 1000;
const IMAGE_INPUT_LIMIT = 20 * 1024 * 1024;
const VIDEO_INPUT_LIMIT = 100 * 1024 * 1024;
let processingQueue = Promise.resolve();

function runFfmpeg(args, signal) {
  if (signal.aborted) return Promise.reject(new Error("Video processing request was aborted."));

  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    let terminationError;

    const terminate = (error) => {
      terminationError ??= error;
      child.kill("SIGKILL");
    };
    const timeout = setTimeout(
      () => terminate(new Error("ffmpeg timed out.")),
      FFMPEG_TIMEOUT_MS,
    );
    const abort = () => terminate(new Error("Video processing request was aborted."));
    signal.addEventListener("abort", abort, { once: true });
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    };

    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-STDERR_LIMIT);
    });
    child.once("error", (error) => {
      settled = true;
      cleanup();
      reject(new Error(`Failed to start ffmpeg: ${error.message}`));
    });
    child.once("close", (code) => {
      if (settled) return;
      cleanup();
      if (terminationError) reject(terminationError);
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

function byteLimit(maxBytes) {
  let received = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new Error(`Video processor input exceeds ${maxBytes} bytes.`));
        return;
      }
      callback(null, chunk);
    },
  });
}

function serialize(task) {
  const result = processingQueue.then(task, task);
  processingQueue = result.catch(() => {});
  return result;
}

function operationFor(url, directory) {
  if (url.pathname === "/pad-frame") {
    const inputPath = path.join(directory, "source.png");
    const outputPath = path.join(directory, "frame.png");
    return {
      inputPath,
      outputPath,
      contentType: "image/png",
      maxInputBytes: IMAGE_INPUT_LIMIT,
      args: buildPadFrameArgs(
        inputPath,
        outputPath,
        url.searchParams.get("width"),
        url.searchParams.get("height"),
      ),
    };
  }

  if (url.pathname === "/chroma-key") {
    const inputPath = path.join(directory, "raw.mp4");
    const outputPath = path.join(directory, "alpha.mov");
    return {
      inputPath,
      outputPath,
      contentType: "video/quicktime",
      maxInputBytes: VIDEO_INPUT_LIMIT,
      args: buildChromaKeyArgs(inputPath, outputPath),
    };
  }

  return null;
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { allow: "POST", "content-type": "text/plain" });
    response.end("Method not allowed.");
    return;
  }

  const directory = await mkdtemp(path.join(tmpdir(), "video-processor-"));
  const abortController = new AbortController();
  request.once("aborted", () => abortController.abort());
  response.once("close", () => {
    if (!response.writableFinished) abortController.abort();
  });
  try {
    const operation = operationFor(new URL(request.url, "http://localhost"), directory);
    if (!operation) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Unknown video processing operation.");
      return;
    }

    const declaredSize = Number(request.headers["content-length"]);
    if (Number.isFinite(declaredSize) && declaredSize > operation.maxInputBytes) {
      throw new Error(`Video processor input exceeds ${operation.maxInputBytes} bytes.`);
    }

    await serialize(async () => {
      if (abortController.signal.aborted) {
        throw new Error("Video processing request was aborted.");
      }
      await pipeline(
        request,
        byteLimit(operation.maxInputBytes),
        createWriteStream(operation.inputPath),
        { signal: abortController.signal },
      );
      await runFfmpeg(operation.args, abortController.signal);

      const output = await stat(operation.outputPath);
      response.writeHead(200, {
        "content-type": operation.contentType,
        "content-length": String(output.size),
      });
      await pipeline(createReadStream(operation.outputPath), response);
    });
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : "Video processing failed.");
    } else {
      response.destroy(error instanceof Error ? error : undefined);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

server.requestTimeout = 60_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Video processor listening on port ${PORT}`);
});
