import assert from "node:assert/strict";
import test from "node:test";

import { storeGeneratedMedia } from "../lib/media-storage.js";

function fakeBucket({ failPut = false } = {}) {
  const objects = new Map();
  return {
    objects,
    async put(key, value, options) {
      if (failPut) throw new Error("R2 unavailable");
      const storedValue = value instanceof ReadableStream
        ? Buffer.from(await new Response(value).arrayBuffer())
        : Buffer.from(value);
      objects.set(key, { value: storedValue, options });
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
  };
}

test("storeGeneratedMedia reserves user-scoped destinations, uploads, and finalizes", async () => {
  const bucket = fakeBucket();
  let reserved;
  let finalized;

  const result = await storeGeneratedMedia({
    bucket,
    bytes: Buffer.from("png"),
    contentType: "image/png",
    kind: "mascot",
    reserveMedia: async (metadata) => {
      reserved = metadata;
      return {
        mediaId: "media-1",
        objectKey: "users/user-1/media/media-1/asset.png",
      };
    },
    finalizeMedia: async (mediaId) => {
      finalized = mediaId;
    },
    abortMedia: async () => assert.fail("completed uploads must not be aborted"),
  });

  assert.deepEqual(result, {
    mediaId: "media-1",
    objectKey: "users/user-1/media/media-1/asset.png",
  });
  assert.deepEqual(reserved, {
    kind: "mascot",
    contentType: "image/png",
    size: 3,
  });
  assert.equal(finalized, "media-1");
  assert.equal(bucket.objects.get(result.objectKey).value.toString(), "png");
  assert.equal(
    bucket.objects.get(result.objectKey).options.httpMetadata.contentType,
    "image/png",
  );
});

test("storeGeneratedMedia stores a private preview at the reserved destination", async () => {
  const bucket = fakeBucket();
  let reserved;

  await storeGeneratedMedia({
    bucket,
    bytes: Buffer.from("mov"),
    contentType: "video/quicktime",
    kind: "video",
    previewBytes: Buffer.from("mp4"),
    previewContentType: "video/mp4",
    reserveMedia: async (metadata) => {
      reserved = metadata;
      return {
        mediaId: "media-2",
        objectKey: "users/user-1/media/media-2/asset.mov",
        previewObjectKey: "users/user-1/media/media-2/preview.mp4",
      };
    },
    finalizeMedia: async () => {},
    abortMedia: async () => {},
  });

  assert.deepEqual(reserved, {
    kind: "video",
    contentType: "video/quicktime",
    size: 3,
    previewContentType: "video/mp4",
    previewSize: 3,
  });
  assert.equal(
    bucket.objects.get("users/user-1/media/media-2/preview.mp4").value.toString(),
    "mp4",
  );
});

test("storeGeneratedMedia accepts an explicit size for streaming container output", async () => {
  const bucket = fakeBucket();
  let reserved;

  await storeGeneratedMedia({
    bucket,
    bytes: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("mov"));
        controller.close();
      },
    }),
    size: 123_456,
    contentType: "video/quicktime",
    kind: "video",
    reserveMedia: async (metadata) => {
      reserved = metadata;
      return {
        mediaId: "media-stream",
        objectKey: "users/user-1/media/media-stream/asset.mov",
      };
    },
    finalizeMedia: async () => {},
    abortMedia: async () => {},
  });

  assert.equal(reserved.size, 123_456);
});

test("storeGeneratedMedia cleans uploaded objects and aborts a reservation when R2 fails", async () => {
  const bucket = fakeBucket({ failPut: true });
  let aborted;

  await assert.rejects(
    storeGeneratedMedia({
      bucket,
      bytes: Buffer.from("png"),
      contentType: "image/png",
      kind: "scene",
      reserveMedia: async () => ({
        mediaId: "media-3",
        objectKey: "users/user-1/media/media-3/asset.png",
      }),
      finalizeMedia: async () => {},
      abortMedia: async (mediaId) => {
        aborted = mediaId;
      },
    }),
    /R2 unavailable/,
  );

  assert.equal(aborted, "media-3");
  assert.equal(bucket.objects.size, 0);
});

test("storeGeneratedMedia preserves uploaded objects when finalization is ambiguous", async () => {
  const bucket = fakeBucket();
  let aborted = false;

  await assert.rejects(
    storeGeneratedMedia({
      bucket,
      bytes: Buffer.from("png"),
      contentType: "image/png",
      kind: "scene",
      reserveMedia: async () => ({
        mediaId: "media-4",
        objectKey: "users/user-1/media/media-4/asset.png",
      }),
      finalizeMedia: async () => {
        throw new Error("Convex response lost");
      },
      abortMedia: async () => {
        aborted = true;
      },
    }),
    /Convex response lost/,
  );

  assert.equal(aborted, false);
  assert.equal(bucket.objects.size, 1);
});

test("storeGeneratedMedia cancels streaming bytes when reservation fails", async () => {
  let cancelledWith;
  const bytes = new ReadableStream({
    cancel(reason) {
      cancelledWith = reason;
    },
  });
  const reservationError = new Error("Convex unavailable");

  await assert.rejects(
    storeGeneratedMedia({
      bucket: fakeBucket(),
      bytes,
      size: 100,
      contentType: "video/quicktime",
      kind: "video",
      reserveMedia: async () => {
        throw reservationError;
      },
      finalizeMedia: async () => {},
      abortMedia: async () => {},
    }),
    /Convex unavailable/,
  );

  assert.equal(cancelledWith, reservationError);
});
