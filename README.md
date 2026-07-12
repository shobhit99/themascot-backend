# Morphling Studio

A Next.js app wrapping an image + video mascot pipeline:

1. Upload a portrait and generate a reusable base mascot with `mascot-prompt.md`.
2. Use that generated mascot as the reference for the sitting-at-a-desk scene in `sitting.md`.
3. Animate the sitting scene into a 4-second, 16:9, silent video with OpenAI Sora 2, using the
   prompt in `video-generation.md`, then key out the green screen with ffmpeg into a
   transparent ProRes 4444 `.mov`.

The UI lives in `app/page.js`. Stages 1-2 run in `/api/generate`
(`app/api/generate/route.js`), which calls OpenAI's image edit endpoint via
`lib/openai-images.js` and returns results as base64 data URLs — no disk writes, so those two
stages have no persistent-storage requirement and deploy cleanly to serverless platforms (e.g.
Vercel). Stage 3 is different — see below.

## Stage 3: video generation

`lib/openai-video.js` calls OpenAI's Videos API (`POST /v1/videos`, model `sora-2`), reusing
`OPENAI_API_KEY` — no separate credential needed. This was confirmed against OpenAI's actual
API reference and guide (not guessed): `size` must be one of `720x1280`, `1280x720`,
`1024x1792`, `1792x1024` (`1280x720` is the 16:9 one), `seconds` must be `"4"`, `"8"`, or
`"12"`, and the reference image must be uploaded via `multipart/form-data` as `input_reference`,
matching the target video's exact resolution. `lib/video-frame.js` pads the 1024x1024 scene PNG
to 1280x720 with the same chroma-green background (rather than cropping, since `sitting.md`
requires the full desk/legs/feet to stay visible) before it's sent.

**Sora always generates audio — there is no request parameter to disable it**, despite the
"audio off" requirement. `lib/chroma-key.js` strips it deterministically with ffmpeg's `-an`
flag on the final render instead.

**We initially tried ElevenLabs (Seedance 2.0)** for this stage but dropped it: their docs list
image-to-video generation as "ElevenCreative Studio API, available upon request," it's absent
from the official `@elevenlabs/elevenlabs-js` SDK, and pulling their full `openapi.json`
(267 endpoints) turned up zero video-generation routes. There was no real endpoint to call.

**This stage requires `ffmpeg` on the host** (`lib/chroma-key.js` and `lib/video-frame.js`
shell out to it) and **writes the final `.mov` to local disk** at `outputs/videos/`, served
back through `/api/videos/[filename]`. Both of those break the "deploys cleanly to serverless"
property stages 1-2 have: Vercel functions don't ship an `ffmpeg` binary and don't persist
local disk writes across invocations. Fine for local dev / a long-running Node host; needs a
real fix (bundled ffmpeg binary or a separate worker, plus real object storage) before stage 3
can run on Vercel. That's intentionally deferred for now.

**Browser playback:** the ProRes 4444 alpha `.mov` is a compositing deliverable (After
Effects, Premiere, Final Cut), not a web-playable format — no browser decodes ProRes or
composites video alpha channels in an HTML `<video>` element. The UI plays the raw
pre-chromakey clip (still has the green screen, muted) inline as a preview and offers the
`.mov` as a download-only link.

## Run locally

Requires Node.js 20+, `ffmpeg` on `PATH`, and an OpenAI API key with image-generation and Sora
video-generation access.

```sh
cp .env.example .env
# Put your key in .env as OPENAI_API_KEY=...
npm install
npm test
npm run dev
```

Open http://localhost:3000. The API key remains on the server and is never sent to the browser.

## Deploy

`npm run build && npm start` produces a standard Next.js production build. On Vercel, import
the repo and set `OPENAI_API_KEY` as an environment variable for stages 1-2 — no other config
needed. Stage 3 (video) is not Vercel-compatible yet; see the caveats above.

Note: Vercel's Hobby plan caps request bodies around 4.5 MB, which is smaller than this
app's 20 MB upload limit. Either raise your plan tier or downsize photos client-side before
upload if you hit that limit in production.
# themascot-backend
