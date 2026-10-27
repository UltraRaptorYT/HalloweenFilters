const cacheName = "afterglow-shell-v4";
const fixedAssets = [
  "/models/face_landmarker.task",
  "/models/pose_landmarker_lite.task",
  "/filters/vampire.webp",
  "/filters/dog-ears.png",
  "/filters/dog-muzzle-v2.png",
  "/filters/dog-lick.png",
  "/filters/grin-red-iris.png",
  "/filters/vampire-ribbon.png",
  "/filters/vampire-fangs.png",
  "/filters/devil-horns.png",
  "/filters/devil-wings.png",
  "/filters/cute-devil-horns.png",
  "/filters/witch-hat-velvet.webp",
  "/filters/voodoo-sockets.webp",
  "/filters/voodoo-triangle.png",
  "/filters/voodoo-tears.webp",
  "/filters/voodoo-iris.webp",
  "/filters/voodoo-white-iris.png",
  "/filters/voodoo-nose.webp",
  "/filters/voodoo-mouth-corner-wrap.png",
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
