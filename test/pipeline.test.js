import assert from "node:assert/strict";
import test from "node:test";

import { generationPrompts } from "../lib/generation-prompts.js";
import { generateImageEdit, validateImageUpload } from "../lib/openai-images.js";

test("generation prompts are bundled as runtime strings", () => {
  assert.match(generationPrompts.mascot, /premium, collectible-quality character illustration/);
  assert.match(generationPrompts.sitting, /sitting on an office chair/);
});

test("validateImageUpload accepts supported image uploads", () => {
  assert.doesNotThrow(() => validateImageUpload({ type: "image/png", size: 1024 }));
});

test("validateImageUpload rejects missing and non-image uploads", () => {
  assert.throws(() => validateImageUpload(null), /Choose a photo/);
  assert.throws(
    () => validateImageUpload({ type: "text/plain", size: 10 }),
    /PNG, JPEG, or WebP/,
  );
});

test("validateImageUpload rejects images larger than 20 MB", () => {
  assert.throws(
    () => validateImageUpload({ type: "image/png", size: 20 * 1024 * 1024 + 1 }),
    /20 MB/,
  );
});

test("generateImageEdit sends an image edit request and returns decoded bytes", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, options };
    return new Response(
      JSON.stringify({ data: [{ b64_json: Buffer.from("generated").toString("base64") }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const output = await generateImageEdit({
    apiKey: "test-key",
    image: new Blob(["source"], { type: "image/png" }),
    fileName: "source.png",
    prompt: "make a mascot",
    fetchImpl: fakeFetch,
  });

  assert.equal(request.url, "https://api.openai.com/v1/images/edits");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(request.options.body.get("model"), "gpt-image-2");
  assert.equal(request.options.body.get("prompt"), "make a mascot");
  assert.equal(request.options.body.get("size"), "1024x1024");
  assert.equal(output.toString(), "generated");
});

test("generateImageEdit surfaces the OpenAI error message", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ error: { message: "Image request failed" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    generateImageEdit({
      apiKey: "test-key",
      image: new Blob(["source"], { type: "image/png" }),
      fileName: "source.png",
      prompt: "make a mascot",
      fetchImpl: fakeFetch,
    }),
    /Image request failed/,
  );
});
