const cacheName = "afterglow-shell-v2";
const fixedAssets = [
  "/models/face_landmarker.task",
  "/models/pose_landmarker_lite.task",
  "/filters/ossuary.webp",
  "/filters/ossuary-alt.webp",
  "/filters/fractured-skin.webp",
  "/filters/frostbitten.webp",
  "/filters/stitched.webp",
  "/filters/vampire.webp",
  "/filters/carnival.webp",
  "/filters/hag.webp",
  "/mediapipe/wasm/vision_wasm_internal.js",
  "/mediapipe/wasm/vision_wasm_internal.wasm",
  "/mediapipe/wasm/vision_wasm_module_internal.js",
  "/mediapipe/wasm/vision_wasm_module_internal.wasm",
  "/mediapipe/wasm/vision_wasm_nosimd_internal.js",
  "/mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const response = await fetch("/");
    if (response.ok) {
      const html = await response.clone().text();
      await cache.put("/", response);
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url.startsWith("/_next/static/"));
      await Promise.allSettled([...new Set(assets)].map((url) => cache.add(url)));
    }
    await Promise.allSettled(fixedAssets.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("afterglow-") && name !== cacheName).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.pathname === "/") {
          const cache = await caches.open(cacheName);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (await caches.match("/")) ?? Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || fixedAssets.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
