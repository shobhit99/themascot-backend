import assert from "node:assert/strict";
import test from "node:test";

import { processVideo, requireContentLength } from "../lib/video-processor.js";

function fakeBinding(handler) {
  const calls = [];
  return {
    calls,
    idFromName(name) {
      calls.push({ type: "idFromName", name });
      return `id:${name}`;
    },
    get(id) {
      calls.push({ type: "get", id });
      return {
        async fetch(request) {
          calls.push({ type: "fetch", request });
          return handler(request);
        },
      };
    },
  };
}

test("processVideo sends a scene image to the container padding operation", async () => {
  const binding = fakeBinding(async (request) => {
    assert.equal(new URL(request.url).pathname, "/pad-frame");
    assert.equal(new URL(request.url).search, "?width=1280&height=720");
    assert.equal(request.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await request.arrayBuffer()).toString(), "scene");
    return new Response("padded", { headers: { "content-type": "image/png" } });
  });

  const response = await processVideo({
    binding,
    operation: "pad-frame",
    bytes: Buffer.from("scene"),
    contentType: "image/png",
    width: 1280,
    height: 720,
  });

  assert.equal(await response.text(), "padded");
  assert.deepEqual(binding.calls.slice(0, 2), [
    { type: "idFromName", name: "video-processor-0" },
    { type: "get", id: "id:video-processor-0" },
  ]);
});

test("processVideo sends raw video to the chroma-key operation", async () => {
  const binding = fakeBinding(async (request) => {
    assert.equal(new URL(request.url).pathname, "/chroma-key");
    assert.equal(new URL(request.url).search, "");
    assert.equal(request.headers.get("content-type"), "video/mp4");
    return new Response("alpha", { headers: { "content-type": "video/quicktime" } });
  });

  const response = await processVideo({
    binding,
    operation: "chroma-key",
    bytes: Buffer.from("raw"),
    contentType: "video/mp4",
  });

  assert.equal(await response.text(), "alpha");
});

test("processVideo rejects missing bindings and unsupported operations", async () => {
  await assert.rejects(
    processVideo({ operation: "pad-frame", bytes: new Uint8Array() }),
    /VIDEO_PROCESSOR binding is not configured/,
  );
  await assert.rejects(
    processVideo({
      binding: fakeBinding(() => new Response()),
      operation: "arbitrary-command",
      bytes: new Uint8Array(),
    }),
    /Unsupported video processing operation/,
  );
});

test("processVideo surfaces a bounded container failure", async () => {
  const binding = fakeBinding(
    async () => new Response(`ffmpeg failed: ${"x".repeat(4_000)}`, { status: 502 }),
  );

  await assert.rejects(
    processVideo({
      binding,
      operation: "chroma-key",
      bytes: Buffer.from("raw"),
      contentType: "video/mp4",
    }),
    (error) => {
      assert.match(error.message, /^Video processing failed \(502\): ffmpeg failed/);
      assert.ok(error.message.length < 2_200);
      return true;
    },
  );
});

test("requireContentLength returns a valid streaming output size", async () => {
  assert.equal(
    await requireContentLength(new Response(null, { headers: { "content-length": "123456" } })),
    123_456,
  );
});

test("requireContentLength cancels invalid streaming output", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
  );

  await assert.rejects(
    requireContentLength(response),
    /content length/,
  );
  assert.equal(cancelled, true);
});
