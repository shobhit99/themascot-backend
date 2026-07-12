import assert from "node:assert/strict";
import test from "node:test";

import { generateSoraVideo } from "../lib/openai-video.js";

test("generateSoraVideo throws when the API key is missing", async () => {
  await assert.rejects(
    generateSoraVideo({
      apiKey: "",
      image: new Blob(["source"], { type: "image/png" }),
      prompt: "animate it",
    }),
    /OPENAI_API_KEY/,
  );
});

test("generateSoraVideo creates a video job, polls until complete, and downloads the content", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url) === "https://api.openai.com/v1/videos") {
      return new Response(JSON.stringify({ id: "video_1", status: "queued" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(url) === "https://api.openai.com/v1/videos/video_1") {
      return new Response(JSON.stringify({ id: "video_1", status: "completed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(url) === "https://api.openai.com/v1/videos/video_1/content") {
      return new Response(Buffer.from("video-bytes"));
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const output = await generateSoraVideo({
    apiKey: "test-key",
    image: new Blob(["source"], { type: "image/png" }),
    prompt: "animate it",
    fetchImpl: fakeFetch,
  });

  assert.equal(output.toString(), "video-bytes");

  const createCall = calls.find((call) => call.url === "https://api.openai.com/v1/videos");
  assert.equal(createCall.options.headers.Authorization, "Bearer test-key");
  assert.equal(createCall.options.body.get("model"), "sora-2");
  assert.equal(createCall.options.body.get("prompt"), "animate it");
  assert.equal(createCall.options.body.get("size"), "1280x720");
  assert.equal(createCall.options.body.get("seconds"), "4");
});

test("generateSoraVideo surfaces a failed generation status", async () => {
  const fakeFetch = async (url) => {
    if (String(url) === "https://api.openai.com/v1/videos") {
      return new Response(JSON.stringify({ id: "video_1", status: "queued" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ status: "failed", error: { message: "generation blocked" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await assert.rejects(
    generateSoraVideo({
      apiKey: "test-key",
      image: new Blob(["source"], { type: "image/png" }),
      prompt: "animate it",
      fetchImpl: fakeFetch,
    }),
    /generation blocked/,
  );
});

test("generateSoraVideo surfaces the OpenAI error message on a failed create request", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ error: { message: "Invalid size" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    generateSoraVideo({
      apiKey: "test-key",
      image: new Blob(["source"], { type: "image/png" }),
      prompt: "animate it",
      fetchImpl: fakeFetch,
    }),
    /Invalid size/,
  );
});
