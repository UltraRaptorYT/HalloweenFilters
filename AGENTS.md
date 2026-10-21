<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AR asset direction

Use generated raster image assets for visible AR props and face details. Do not use SVGs, circles, ellipses, or primitive geometric blocks as visual stand-ins for AR content. Track generated assets to the face and animate them from live facial landmarks or blendshapes.

Build face effects from separate, targeted details such as eyes, nose, mouth, and props. Keep the live camera face visible beneath them; do not use generated full-face masks as a replacement or overlay for the whole face.

### Voodoo Skull reference

- Keep the smoky eye shadow as a soft, blurred radial pigment treatment; do not cover the eye area with a mask image.
- Track the red iris on the viewer's left and a bright white eye with a black pupil on the viewer's right, clipping both raster details to the live eye contours like The Grin.
- Sort eye landmarks by their screen position before deriving face rotation so mirrored selfie video cannot turn assets upside down.
- Keep eye liner to two short, smooth upper-lid strokes; do not connect a thick line across both eyes or pupils.
- Use large, separated, textured raster triangle marks across and slightly beyond the upper and lower lip corners; flip the same marks for the lower lip and track each row independently so they separate when the mouth opens. Do not use a continuous mouth decal.
- Blend smoky makeup with soft charcoal and muted burgundy gradients, feathered edges, and fine liner so it reads as applied makeup rather than flat graphics.
- Keep the nose detail close to the eyes, and make the paired lower-eye markings wide enough to read clearly at portrait scale.
- Use the same tear shape for both marks above the eyes; flip both upside down, mirror one across the face, rotate each to follow its brow, and layer them behind the eye openings and eye decals.
- Check the visible orientation of every generated decal in the mirrored camera view before adding it to a filter.

## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

This is a single-context repo. See `docs/agents/domain.md`.
