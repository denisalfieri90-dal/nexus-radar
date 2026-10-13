/* Service worker di Nexus: rende il sito un'app installabile e utilizzabile offline.
   - asset statici (/_next/static, font, icone): cache-first, sono versionati
   - dati (/data/*.json) e pagine: network-first, con ripiego sull'ultima copia salvata */
const VERSION = "nexus-v2";
const SHELL = ["/", "/temi/", "/journal/", "/altro/", "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // il servizio briefing passa sempre dalla rete

  const immutable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(woff2?|ttf)$/.test(url.pathname);
  if (immutable) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(
          (hit) => hit || (req.mode === "navigate" ? caches.match("/") : Response.error()),
        ),
      ),
  );
});
