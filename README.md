# Afterglow Halloween Photo Booth

A desktop-first browser photo booth with live face tracking, generated Halloween looks, and QR photo sharing. Photos stay in one shared gallery; there is no event setup or event selection.

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000` in a browser that supports webcam access. The browser will ask for camera permission. Camera access requires HTTPS outside localhost.

## Configure photo sharing

1. Create a Supabase project and run the SQL migrations in `supabase/migrations` in filename order.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, and a global `NEXT_PUBLIC_PASSCODE` for host access.
3. Keep `SUPABASE_SECRET_KEY` server-only. Restart the app.
4. Open `/host` and enter the global passcode to review or delete shared photos.

The `halloween-photos` Storage bucket is private. Share pages use an unguessable photo URL and generate a short-lived signed Storage URL each time they open. Photos remain available until the host deletes them from the global gallery.

## Capture and offline sync

After the three-second countdown, guests can review or retake the photo. Keeping it saves it to the booth's IndexedDB queue and uploads it when the network is available. The QR code appears after upload. If the booth goes offline, keep the browser open or reopen it on the same booth later; queued photos stay on that device until they sync.

## Live looks

The original filter concepts remain in the collection with realistic makeup or full-face transformation treatments. Generated portrait assets are preprocessed at startup with MediaPipe FaceLandmarker, then warped over live facial landmarks. A transparent Three.js layer adds tracked 3D pieces—such as cat ears, horns, wings, crystals, and flowers—and follows face position, scale, roll, and turn. Tracking runs in the browser; no frame-by-frame image generation is used.
