const CACHE_NAME = "did-app-v1";

// Install
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ✅ FETCH (PUT YOUR CODE HERE)
self.addEventListener("fetch", (event) => {
  // Handle navigation (React routing / pages)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Handle other requests (images, JS, CSS)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});