<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AR asset direction

Use generated raster image assets for visible AR props and face details. Do not use SVGs, circles, ellipses, or primitive geometric blocks as visual stand-ins for AR content. Track generated assets to the face and animate them from live facial landmarks or blendshapes.

Build face effects from separate, targeted details such as eyes, nose, mouth, and props. Keep the live camera face visible beneath them; do not use generated full-face masks as a replacement or overlay for the whole face.

## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

This is a single-context repo. See `docs/agents/domain.md`.
