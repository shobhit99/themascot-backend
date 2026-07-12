# Cloudflare FFmpeg Container Design

## Problem

The video route currently imports filesystem APIs and FFmpeg helpers that spawn a bundled binary. Cloudflare Workers cannot create child processes or rely on a writable local filesystem, so the route cannot generate its padded Sora reference frame or transparent ProRes output after deployment. R2 and Convex already provide persistent storage and metadata once the bytes exist.

## Architecture

Run FFmpeg in a Cloudflare Container attached to the existing OpenNext Worker through a Durable Object binding. The container exposes two private HTTP operations:

- `POST /pad-frame?width=1280&height=720` accepts the scene PNG and returns a padded PNG.
- `POST /chroma-key` accepts Sora's MP4 and returns a silent ProRes 4444 MOV with alpha.

The Next.js route obtains the container binding from `getCloudflareContext`, sends bytes to the container, calls Sora between the two transformations, and streams the returned MOV into the existing R2/Convex storage function using the container's `Content-Length` for metadata. No container endpoint is exposed publicly.

## Components

- `lib/video-processor.js` is a Worker-safe client for the container binding. It selects a named instance, preserves the streaming response, and converts non-success responses into bounded errors.
- `container/server.js` is the container-only Node.js HTTP server. It streams each request to an isolated temporary directory, invokes FFmpeg with fixed argument templates, streams the output, and cleans up.
- `container/Dockerfile` provides Linux, Node.js, and FFmpeg.
- `worker.js` wraps the generated OpenNext Worker and exports the `VideoProcessorContainer` class required by Cloudflare Containers.
- `wrangler.jsonc` declares the container image, Durable Object binding, and SQLite migration.

## Data Flow

1. Authenticate and validate the uploaded scene image in the Worker.
2. Send the image body to a named `VIDEO_PROCESSOR` container and receive the padded PNG.
3. Submit that PNG to Sora and poll for the raw MP4.
4. Send the raw MP4 to the same container and receive a streaming transparent MOV response with an exact content length.
5. Reserve metadata in Convex, stream the MOV and upload the raw preview to private R2, and finalize the record.

## Errors and Limits

The client rejects a missing binding and invalid operation before making a request. Container errors return status 502 with a short diagnostic; the Worker surfaces a generic processing failure without exposing a public container address. Width and height are allow-listed to the pipeline's 1280x720 output so query parameters cannot become arbitrary FFmpeg arguments. Request bodies retain the route's existing 20 MB input validation; generated video sizes remain governed by Worker and Container platform request limits.

## Testing

Unit tests prove the Worker client routes both operations through the binding, preserves content types, and surfaces failures. Container command tests prove that only the intended FFmpeg arguments are constructed. The full Node test suite, Next build, OpenNext Cloudflare build, Wrangler configuration validation, and a Docker image build verify their respective boundaries. A source scan ensures Worker-reachable modules no longer import `node:child_process` or temporary filesystem APIs.
