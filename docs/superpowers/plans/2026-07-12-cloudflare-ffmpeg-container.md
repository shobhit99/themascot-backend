# Cloudflare FFmpeg Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move both FFmpeg transformations out of the Cloudflare Worker and into a deployable Cloudflare Container while preserving Sora generation and R2/Convex storage.

**Architecture:** A Worker-safe client sends binary bodies through a Durable Object container binding. A private Node.js service inside the container owns temporary files and FFmpeg, while a custom Worker entrypoint exports the Container class alongside the generated OpenNext handler.

**Tech Stack:** Next.js 16, OpenNext Cloudflare, Cloudflare Containers, Node.js 20, FFmpeg, R2, Convex, `node:test`

## Global Constraints

- No Worker-reachable module may import `node:child_process` or use temporary filesystem paths.
- The container is reachable only through the `VIDEO_PROCESSOR` Durable Object binding.
- Preserve the existing 1280x720 reference frame, chroma-key filter, silent ProRes 4444 output, R2 objects, and Convex metadata.
- Container request parameters must not permit arbitrary FFmpeg arguments.

---

### Task 1: Worker-safe video processor client

**Files:**
- Create: `lib/video-processor.js`
- Create: `test/video-processor.test.js`

**Interfaces:**
- Consumes: `DurableObjectNamespace`-compatible `idFromName` and `get` methods.
- Produces: `processVideo({ binding, operation, bytes, contentType, width, height }) => Promise<Response>` so large outputs remain streaming.

- [ ] Write tests for pad-frame routing, chroma-key routing, missing bindings, invalid operations, and failed responses.
- [ ] Run `node --test test/video-processor.test.js` and confirm it fails because the module does not exist.
- [ ] Implement the minimal binding client with fixed operation paths and bounded error handling.
- [ ] Run `node --test test/video-processor.test.js` and confirm all cases pass.

### Task 2: Container FFmpeg service

**Files:**
- Create: `container/ffmpeg-operations.js`
- Create: `container/server.js`
- Create: `container/Dockerfile`
- Create: `test/ffmpeg-operations.test.js`
- Delete: `lib/ffmpeg.js`
- Delete: `lib/chroma-key.js`
- Delete: `lib/video-frame.js`
- Delete: `test/chroma-key.test.js`
- Delete: `test/video-frame.test.js`

**Interfaces:**
- Consumes: raw PNG or MP4 request bodies.
- Produces: fixed `buildPadFrameArgs` and `buildChromaKeyArgs` command templates, plus HTTP PNG or MOV responses.

- [ ] Write tests asserting the exact FFmpeg templates and rejecting unsupported dimensions.
- [ ] Run `node --test test/ffmpeg-operations.test.js` and confirm it fails because the module does not exist.
- [ ] Implement the fixed command templates, streaming HTTP server, isolated temporary directories, error responses, and cleanup.
- [ ] Add the FFmpeg container image and remove the Worker-side FFmpeg modules and their host-binary integration tests.
- [ ] Run `node --test test/ffmpeg-operations.test.js` and confirm all cases pass.

### Task 3: Pipeline and Cloudflare deployment wiring

**Files:**
- Create: `worker.js`
- Modify: `app/api/generate-video/route.js`
- Modify: `wrangler.jsonc`
- Modify: `next.config.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `lib/media-storage.js`

**Interfaces:**
- Consumes: `env.VIDEO_PROCESSOR` from OpenNext's Cloudflare context.
- Produces: the existing `{ mediaId, videoUrl, previewUrl }` API response and a `VideoProcessorContainer` Worker export.

- [ ] Rewrite the route to call `processVideo` before and after Sora, buffer only the small padded PNG, and stream the ProRes result into R2 with an explicit size.
- [ ] Wrap `.open-next/worker.js`, export its existing Durable Objects, and add `VideoProcessorContainer extends Container`.
- [ ] Declare the container, Durable Object binding, migration, image path, and instance pool in Wrangler.
- [ ] Remove `ffmpeg-static`, install `@cloudflare/containers`, and update deployment documentation.
- [ ] Run the focused tests and confirm they pass.

### Task 4: Completion verification and commit

**Files:**
- Verify all changed files.

**Interfaces:**
- Consumes: completed implementation.
- Produces: a verified commit on the current branch.

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Run `npx opennextjs-cloudflare build` and require exit code 0.
- [ ] Run `npx wrangler deploy --dry-run` and require config/bundle validation to pass.
- [ ] Run `docker build -f container/Dockerfile container` and require the image to build.
- [ ] Scan Worker-reachable source for `node:child_process`, `node:fs`, `node:os`, and `ffmpeg-static` and require no matches.
- [ ] Review `git diff`, commit with `fix: move video processing to Cloudflare Container`, and inspect the resulting commit.
