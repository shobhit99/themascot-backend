function byteLength(value) {
  if (typeof value?.byteLength === "number") return value.byteLength;
  if (typeof value?.size === "number") return value.size;
  throw new TypeError("Generated media must expose byteLength or size.");
}

function cancelReadable(value, reason) {
  if (typeof value?.cancel !== "function") return Promise.resolve();
  return Promise.resolve().then(() => value.cancel(reason));
}

async function putObject({
  bucket,
  key,
  value,
  size,
  contentType,
  FixedLengthStreamImpl,
}) {
  const options = { httpMetadata: { contentType } };
  if (typeof value?.pipeTo !== "function") {
    return bucket.put(key, value, options);
  }
  if (!FixedLengthStreamImpl) {
    throw new Error("FixedLengthStream is not available in this runtime.");
  }

  const { readable, writable } = new FixedLengthStreamImpl(size);
  const abortController = new AbortController();
  const transfer = value.pipeTo(writable, { signal: abortController.signal });
  try {
    const [, result] = await Promise.all([
      transfer,
      bucket.put(key, readable, options),
    ]);
    return result;
  } catch (error) {
    abortController.abort(error);
    await Promise.allSettled([transfer]);
    throw error;
  }
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
  FixedLengthStreamImpl = globalThis.FixedLengthStream,
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
    await putObject({
      bucket,
      key: reservation.objectKey,
      value: bytes,
      size: metadata.size,
      contentType,
      FixedLengthStreamImpl,
    });
    uploadedKeys.push(reservation.objectKey);

    if (previewBytes && reservation.previewObjectKey) {
      await putObject({
        bucket,
        key: reservation.previewObjectKey,
        value: previewBytes,
        size: metadata.previewSize,
        contentType: previewContentType,
        FixedLengthStreamImpl,
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
