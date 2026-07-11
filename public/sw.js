// Service Worker de Almacén Diana G 🐝
// Guarda la app en el dispositivo para que abra aunque no haya internet.
// No toca las peticiones a Supabase (otro dominio): esas van directo a la red.

const CACHE = "adg-cache-v2";
const SHELL = "app-shell";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo GET del mismo origen; lo demás (Supabase, POST, etc.) va directo a la red.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Nunca cachear la API (ej: la comprobación de versión debe ser siempre fresca).
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones (abrir una página): red primero, con respaldo del caché.
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
          cache.put(SHELL, res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(req)) || (await cache.match(SHELL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Recursos estáticos (JS/CSS/imágenes): caché primero, luego red (y se guardan).
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const enCache = await cache.match(req);
      if (enCache) return enCache;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      } catch {
        return enCache || Response.error();
      }
    })(),
  );
});
