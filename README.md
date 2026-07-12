# Morphling Studio

A Next.js app wrapping a two-stage OpenAI image pipeline:

1. Upload a portrait and generate a reusable base mascot with `mascot-prompt.md`.
2. Use that generated mascot as the reference for the sitting-at-a-desk scene in `sitting.md`.

The UI lives in `app/page.js`; the pipeline runs server-side in the `/api/generate` route
handler (`app/api/generate/route.js`), which calls OpenAI's image edit endpoint via
`lib/openai-images.js`. Generated images are returned to the browser as base64 data URLs
rather than written to disk, so the app has no persistent-storage requirement and deploys
cleanly to serverless platforms (e.g. Vercel).

## Run locally

Requires Node.js 20+ and an OpenAI API key with image-generation access.

```sh
cp .env.example .env
# Put your key in .env as OPENAI_API_KEY=...
npm install
npm test
npm run dev
```

Open http://localhost:3000. The API key remains on the server and is never sent to the browser.

## Deploy

`npm run build && npm start` produces a standard Next.js production build. On Vercel, just
import the repo and set `OPENAI_API_KEY` as an environment variable — no other config needed.

Note: Vercel's Hobby plan caps request bodies around 4.5 MB, which is smaller than this
app's 20 MB upload limit. Either raise your plan tier or downsize photos client-side before
upload if you hit that limit in production.
# themascot-backend
