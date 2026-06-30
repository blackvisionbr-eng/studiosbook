const CACHE_PREFIX = "studiosbook-";
const CACHE_NAME = "studiosbook-v6";

const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#402239">
    <title>StudiosBook offline</title>
  </head>
  <body style="margin:0;background:#f6f1ef;color:#18181b;font-family:system-ui,sans-serif">
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center">
      <div>
        <h1 style="margin:0 0 12px;font-size:28px">Sem conexao</h1>
        <p style="margin:0;line-height:1.6">Verifique sua internet e atualize a pagina.</p>
      </div>
    </main>
  </body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(request).catch(() => offlineResponse()));
});
