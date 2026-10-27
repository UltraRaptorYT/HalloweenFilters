<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AR asset direction

Use generated raster image assets for visible AR props and face details unless the user explicitly requests procedural geometry. Do not use SVGs, circles, ellipses, or primitive geometric blocks as visual stand-ins for AR content. Track generated assets to the face and animate them from live facial landmarks or blendshapes. For a specifically requested mesh detail, build a textured or vertex-defined mesh that follows live facial landmarks.

Keep each filter's visual assets, drawing, geometry, and pose-update logic in its own filter module. The page and shared tracked renderer should handle camera/frame orchestration and dispatch only; put reusable tracking and projection helpers in shared modules.

Build face effects from separate, targeted details such as eyes, nose, mouth, and props. Keep the live camera face visible beneath them; do not use generated full-face masks as a replacement or overlay for the whole face.

### Voodoo Skull reference

- Keep the smoky eye shadow as a soft, blurred radial pigment treatment; do not cover the eye area with a mask image.
- Track a red iris on the viewer's left and a white version of the same iris artwork on the viewer's right, clipping both to their live eye contours.
- Sort eye landmarks by their screen position before deriving face rotation so mirrored selfie video cannot turn assets upside down.
- Keep eye liner to two short, smooth upper-lid strokes; do not connect a thick line across both eyes or pupils.
- Use individually tracked, textured triangle marks along both lip contours, tilted to follow the local curve and flipped on the lower lip; let the rows separate when the mouth opens. Do not use a continuous smile decal.
- Extend the mouth corners with black raster lines mapped onto the tracked 3D cheek surface, arcing upward with a thick lip-corner start, smooth outward taper, and small cracks; mirror the same detail on both sides.
- Use a monochrome camera feed and scene in Voodoo Skull mode while keeping the red and white iris details colored.
- Blend smoky makeup with soft charcoal and muted burgundy gradients, feathered edges, and fine liner so it reads as applied makeup rather than flat graphics.
- Keep the nose detail close to the eyes, and make the paired lower-eye markings wide enough to read clearly at portrait scale.
- Use the same tear shape for both marks above the eyes; flip both upside down, mirror one across the face, rotate each to follow its brow, and layer them behind the eye openings and eye decals.
- Check the visible orientation of every generated decal in the mirrored camera view before adding it to a filter.
- Before shipping any generated decal or 3D prop, verify its rendered top/bottom orientation in the live camera view; image texture UVs and screen-to-world Y conversions can flip assets even when the landmark math looks right. For textured meshes, test with an asymmetric mark so a vertical flip is obvious, then correct UVs or local mesh axes based on the rendered result.
- In this renderer, use cute neon-red line horns with a bright inner core and soft glow for Cute Devil; avoid solid glossy horns. Negate the horn patch's forehead axis so the tips point upward in the live camera view; the textured mesh's vertical UV mapping otherwise flips them. Build the Witch Hat crown toward local negative Y so its tip points upward from the brim in the rendered view. Place the Witch Hat on the top of the tracked head with a brim wide enough to cover the head, and orient it from the full 3D eye, forehead, and chin axes so yaw, pitch, and roll follow the person's head.

### Pennywise reference

- Draw the red details procedurally as face-tracked mesh makeup. Keep the forehead portion short, stop it at the upper eyelid, and resume below the lower eyelid so the streak reads as cut through the eye rather than painted over the eye opening; continue the lower curve across the cheek to the lip corner.
- Feather streak edges with a soft, translucent mesh alpha gradient, and use a similarly soft red pigment gradient on the nose instead of a hard-edged solid circle.
- Use the live camera texture on the tracked upper and lower lip meshes, applying a restrained saturation and red-channel boost there so natural lip texture, highlights, and shading remain visible; leave the mouth opening uncovered.
- Keep the curves attached to the face triangulation so they follow head tilt and turn; inspect the rendered orientation in the mirrored camera view.

## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

This is a single-context repo. See `docs/agents/domain.md`.
