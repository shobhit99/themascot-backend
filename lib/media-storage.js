function byteLength(value) {
  if (typeof value?.byteLength === "number") return value.byteLength;
  if (typeof value?.size === "number") return value.size;
  throw new TypeError("Generated media must expose byteLength or size.");
}

function cancelReadable(value, reason) {
  if (typeof value?.cancel !== "function") return Promise.resolve();
  return Promise.resolve().then(() => value.cancel(reason));
}

export async function storeGeneratedMedia({
  bucket,
  bytes,
  size,
  contentType,
  kind,
  previewBytes,
  previewContentType,
  reserveMedia,
  finalizeMedia,
  abortMedia,
}) {
  const metadata = {
    kind,
    contentType,
    size: size ?? byteLength(bytes),
  };
  if (previewBytes) {
    metadata.previewContentType = previewContentType;
    metadata.previewSize = byteLength(previewBytes);
  }

  let reservation;
  try {
    reservation = await reserveMedia(metadata);
  } catch (error) {
    await Promise.allSettled([cancelReadable(bytes, error)]);
    throw error;
  }
  const uploadedKeys = [];

  try {
    await bucket.put(reservation.objectKey, bytes, {
      httpMetadata: { contentType },
    });
    uploadedKeys.push(reservation.objectKey);

    if (previewBytes && reservation.previewObjectKey) {
      await bucket.put(reservation.previewObjectKey, previewBytes, {
        httpMetadata: { contentType: previewContentType },
      });
      uploadedKeys.push(reservation.previewObjectKey);
    }
  } catch (error) {
    await Promise.allSettled([
      cancelReadable(bytes, error),
      uploadedKeys.length ? bucket.delete(uploadedKeys) : Promise.resolve(),
      abortMedia(reservation.mediaId),
    ]);
    throw error;
  }

  // Never delete uploaded objects after this point. A failed finalization response is
  // ambiguous: Convex may have committed it, so preserving the objects avoids broken records.
  await finalizeMedia(reservation.mediaId);
  return reservation;
}
