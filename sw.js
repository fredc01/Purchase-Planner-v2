// Keeps the page shell available offline. Always tries the network first so updates show up right away.
const CACHE = "purchase-planner-v3";
const SHELL = ["./", "index.html", "css/style.css", "js/config.js", "js/api.js", "js/ui.js", "js/board.js", "js/bulk.js", "js/insights.js", "js/main.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;   // data and fonts always come straight from the internet
  e.respondWith(
    fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match("index.html")))
  );
});
