const CACHE_NAME = "roster-cache-v14"; // Bumped for logo resizing
const urlsToCache = [
  "./",
  "./config.js",
  "./hsaas-logo.png",
  "./index.html",
  "./contacts.html",
  "./style.css",
  "./script.js",
  "./contacts.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./offline.html"
];

// ---- Install: precache essential assets (best-effort) ----
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urlsToCache.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((res) => { if (res && res.ok) return cache.put(url, res); })
            .catch(() => console.warn("[SW] Failed to cache:", url))
        )
      )
    )
  );
});

// ---- Activate: cleanup old caches & take control ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );

  // Optional: notify clients there's a new SW
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => clients.forEach((c) => c.postMessage({ type: "UPDATE_AVAILABLE" })))
  );
});

// ---- Fetch: single listener with proper bypass & strategies ----
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Strategy: Roster Data -> network-first (ensure offline availability)
  // We detect snapshot.json by the file name so it works on GitHub or Internal servers
  if (url.pathname.endsWith('/snapshot.json')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Bypass cross-origin (except the snapshot)
  if (url.origin !== self.location.origin) return;

  // Bypass auth-related routes
  if (
    url.pathname.endsWith("/callback.html") ||
    url.pathname.endsWith("/login.html") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Strategy: HTML -> network-first (avoid stale pages that can break auth)
  const isHTML =
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/" ||
    url.pathname === "";

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Update cache copy for offline
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline: serve cached page, else offline.html
          const cached = await caches.match(request);
          return cached || caches.match("./offline.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(request, responseToCache)
            );
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
