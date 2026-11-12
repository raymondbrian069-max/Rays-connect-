const CACHE_NAME = "rays-connect-shell-v2";
const CORE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.svg",
  "/icon-512.svg"
];

async function cacheBuildAssets(cache) {
  const response = await fetch("/", { cache: "no-cache" });
  if (!response.ok) throw new Error("Unable to load the app shell.");
  const html = await response.clone().text();
  await cache.put("/", response);

  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/") && /\.(?:js|css)(?:\?|$)/i.test(url));

  if (assets.length) await cache.addAll([...new Set(assets)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_URLS);
    await cacheBuildAssets(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("rays-connect-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
        }
        return response;
      }).catch(async () => (await caches.match(request)) || caches.match("/index.html"))
    );
    return;
  }

  const url = new URL(request.url);
  const isAppAsset = url.pathname.startsWith("/assets/") ||
    ["/manifest.json", "/icon.svg", "/icon-192.svg", "/icon-512.svg"].includes(url.pathname);

  if (!isAppAsset) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
  );
});
