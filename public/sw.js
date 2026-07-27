// ─── CorreTop PWA Service Worker ─────────────────────────────────────────────
// Versão: 1.0.1
// Incremente CACHE_VERSION para forçar atualização do cache.

const CACHE_VERSION = 4;
const STATIC_CACHE = `corretop-static-v${CACHE_VERSION}`;
const NAV_CACHE = `corretop-nav-v${CACHE_VERSION}`;
const ASSET_CACHE = `corretop-assets-v${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/logo_icon.jpg",
];

// ─── Instalação ───────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ─── Ativação ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Limpa caches antigos
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== NAV_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      ),
      // Assume controle imediato de todas as abas
      self.clients.claim(),
    ])
  );
});

// ─── Estratégias de Cache ─────────────────────────────────────────────────────

// Assets estáticos (JS, CSS, fontes, imagens) → Cache First
function isStaticAsset(url) {
  return /(\.(js|css|svg|png|jpg|jpeg|webp|ico|woff2?|ttf|otf))$/.test(url.pathname);
}

// Navegação (páginas HTML) → Network First com fallback para cache
function isNavigation(request) {
  return request.mode === "navigate";
}

// API calls → Network Only (não cachear dados dinâmicos)
function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/");
}

// ─── Interceptação de Fetch ───────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Só intercepta requisições do mesmo origin
  if (url.origin !== self.location.origin) return;

  // Não cachear requisições de API ou Next.js internas
  if (isApiRequest(url)) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // Assets estáticos → Cache First
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response(null, { status: 503 }));
      })
    );
    return;
  }

  // Navegação → Network First com fallback offline
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(NAV_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Demais requisições (manifest, etc.) → Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          // Clone immediately before any consumer can read the body
          const cloned = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned));
        }
        return response;
      }).catch(() => cached || new Response(null, { status: 503 }));
      return cached || fetchPromise;
    })
  );
});

// ─── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data.json();
      } catch {
        data = { body: event.data.text() };
      }

      // Check existing active notifications on the device
      const existing = await self.registration.getNotifications();

      // If device already has 3 or more active notifications, collapse into a single summary card
      if (existing.length >= 3) {
        // Close individual notifications to avoid cluttering the screen
        for (const n of existing) {
          if (n.tag !== "corretop-device-summary") {
            n.close();
          }
        }

        const totalCount = existing.length + 1;
        return self.registration.showNotification(`Você tem ${totalCount} notificações no CorreTop`, {
          body: "Existem várias novidades acumuladas no seu painel. Clique para abrir.",
          icon: "/logo_icon.jpg",
          badge: "/logo_icon.jpg",
          tag: "corretop-device-summary",
          renotify: false,
          requireInteraction: false,
          data: { url: "/", dateOfArrival: Date.now() },
          actions: [
            { action: "open", title: "Abrir Painel" },
            { action: "close", title: "Fechar" },
          ],
        });
      }

      const title = data.title || "CorreTop CRM";
      const options = {
        body: data.body || "",
        icon: data.icon || "/logo_icon.jpg",
        badge: "/logo_icon.jpg",
        vibrate: data.vibrate || [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: "corretop-push",
          url: data.url || "/",
          ...data.data,
        },
        tag: data.tag || "corretop-default",
        renotify: data.renotify || false,
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || [
          { action: "open", title: "Abrir" },
          { action: "close", title: "Fechar" },
        ],
      };

      return self.registration.showNotification(title, options);
    })()
  );
});

// ─── Clique em Notificação ────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já existe uma aba aberta, foca nela e navega
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // Se não existe, abre nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Ações de Notificação ─────────────────────────────────────────────────────

self.addEventListener("notificationclose", (event) => {
  // Log opcional para analytics
  console.log("Notificação fechada:", event.notification.tag);
});

