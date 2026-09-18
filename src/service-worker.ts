import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';

declare const self: any;

const CURRENT_VERSION = '8.9b';
const SHELL_CACHE_NAME = `app-shell-cache-v${CURRENT_VERSION}`;
const STATIC_CACHE_NAME = `static-assets-cache-v${CURRENT_VERSION}`;

// Ativar e registrar imediatamente o novo service worker e assumir o controle dos clientes
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Garantir que a casca da aplicação (App Shell) esteja permanentemente em cache dedicado versionado
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE_NAME);
        const reqs = ['/', '/index.html'].map((url) => new Request(url, { cache: 'reload' }));
        await cache.addAll(reqs);
      } catch (e) {
        console.warn('[SW] Pré-cache de contingência do app-shell finalizado com aviso:', e);
      }
    })()
  );
});

// Limpar caches antigos ou conflitantes (incluindo caches legados da v6.9b e app-shell não versionado)
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        if ('caches' in self) {
          const keys = await caches.keys();
          await Promise.all(
            keys.map((key: string) => {
              if (
                key === 'app-shell-cache' ||
                key === 'firestore-data-cache' ||
                (key.startsWith('app-shell-cache-') && key !== SHELL_CACHE_NAME) ||
                (key.startsWith('static-assets-cache') && key !== STATIC_CACHE_NAME) ||
                key.includes('v6.9') ||
                key.includes('6.9b') ||
                key.includes('v7.') ||
                key.includes('v8.0') ||
                key.includes('v8.1') ||
                key.includes('v8.2') ||
                key.includes('v8.3') ||
                key.includes('v8.4') ||
                key.includes('v8.5') ||
                key.includes('v8.6') ||
                key.includes('v8.7') ||
                key.includes('v8.8')
              ) {
                console.log('[SW] Purgando cache legado / obsoleto:', key);
                return caches.delete(key);
              }
              return Promise.resolve();
            })
          );
        }
      } catch (err) {
        console.warn('[SW] Aviso ao ativar e purgar caches legados:', err);
      }
    })()
  );
});

// Ouvinte para mensagens de SKIP_WAITING enviadas pelo aplicativo cliente
self.addEventListener('message', (event: any) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING' || event.data?.type === 'CHECK_UPDATE')) {
    self.skipWaiting();
  }
  if (event.data && (event.data.type === 'PURGE_ALL_CACHES' || event.data === 'PURGE_ALL_CACHES')) {
    if ('caches' in self) {
      caches.keys().then((keys: string[]) => Promise.all(keys.map((k) => caches.delete(k))));
    }
    self.skipWaiting();
  }
});

precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell / Navigation Fallback
// Uses NetworkFirst online so user gets newest bundles immediately,
// and gracefully falls back to precached index.html when offline
const navigationStrategy = new NetworkFirst({
  cacheName: SHELL_CACHE_NAME,
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
});

const navigationRoute = new NavigationRoute(navigationStrategy, {
  denylist: [
    new RegExp('/__/'), // Exclude Firebase reserved URLs
    new RegExp('/api/'), // Exclude API routes
  ],
});
registerRoute(navigationRoute);

// Fallback robust navigation handler for offline mode
registerRoute(
  ({ request, url }) =>
    (request.mode === 'navigate' || request.destination === 'document') &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/__/'),
  async ({ request }) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached =
          (await matchPrecache('index.html')) ||
          (await matchPrecache('/index.html')) ||
          (await caches.match('index.html')) ||
          (await caches.match('/index.html')) ||
          (await caches.match('/', { cacheName: SHELL_CACHE_NAME })) ||
          (await caches.match('/index.html', { cacheName: SHELL_CACHE_NAME }));
        if (cached) return cached;
      }
      return await fetch(request);
    } catch {
      const fallback =
        (await matchPrecache('index.html')) ||
        (await matchPrecache('/index.html')) ||
        (await caches.match('index.html')) ||
        (await caches.match('/index.html')) ||
        (await caches.match('/', { cacheName: SHELL_CACHE_NAME })) ||
        (await caches.match('/index.html', { cacheName: SHELL_CACHE_NAME }));
      if (fallback) return fallback;
      return new Response(
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>DAVVERO - Modo Offline</title></head><body><h1>DAVVERO System Offline</h1><p>A carteirinha institucional funciona com dados salvos.</p></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }
);

// Catch handler for any unhandled navigation failure (NEVER return Response.error() to prevent net::ERR_FAILED)
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate' || request.destination === 'document') {
    const fallback =
      (await matchPrecache('index.html')) ||
      (await matchPrecache('/index.html')) ||
      (await caches.match('index.html')) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/', { cacheName: SHELL_CACHE_NAME })) ||
      (await caches.match('/index.html', { cacheName: SHELL_CACHE_NAME }));
    if (fallback) return fallback;
  }
  // Retornar status HTTP amigável ao invés de Response.error() para nunca crashar o navegador em ERR_FAILED
  return new Response(null, {
    status: 503,
    statusText: 'Service Unavailable Offline',
  });
});

// Background Sync para requisições de API (Emails, Push, Certificados)
const apiBgSyncPlugin = new BackgroundSyncPlugin('davvero-api-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 Hours
});

// Garantir que rotas de API NUNCA sejam cacheadas e acessem a rede diretamente
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [apiBgSyncPlugin]
  })
);

// Cache para fontes do Google e webfonts
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 ano
      }),
    ],
  })
);

// Cache para estilos, scripts e fontes locais
registerRoute(
  ({ request, url }) =>
    (request.destination === 'style' ||
     request.destination === 'script' ||
     request.destination === 'font') &&
    !url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache para imagens profile/eventos (exclui ícones do sistema e manifest para garantir atualização imediata)
registerRoute(
  ({ request, url }) =>
    (request.destination === 'image' || url.origin.includes('firebasestorage.googleapis.com')) &&
    !url.pathname.includes('icon') &&
    !url.pathname.includes('apple-touch-icon') &&
    !url.pathname.includes('favicon') &&
    !url.pathname.includes('manifest'),
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
      }),
    ],
  })
);

self.addEventListener("push", (event: any) => {
  if (!event.data) return;

  let title = "DAVVERO System";
  let body = "Você recebeu uma nova notificação.";
  let url = "/";
  let icon = "/icon-192.png";
  let badge = "/icon-192.png";
  let tag = "davvero-push-" + Date.now();

  try {
    const json = event.data.json();
    title = json.title || json.notification?.title || title;
    body = json.body || json.message || json.notification?.body || body;
    url = json.url || json.data?.url || json.notification?.click_action || url;
    icon = json.icon || json.notification?.icon || icon;
    tag = json.tag || tag;
  } catch (err) {
    const textData = event.data.text();
    if (textData) {
      body = textData;
    }
  }

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    vibrate: [150, 50, 150],
    data: {
      url,
      time: Date.now()
    }
  };

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options);
      } catch (err) {
        console.warn("ServiceWorker push showNotification fallback:", err);
        await self.registration.showNotification(title, {
          body,
          data: { url }
        });
      }

      // Sincroniza o App Badge no Windows / PWA
      try {
        const notifs = await self.registration.getNotifications();
        const count = notifs.length || 1;
        if ("setAppBadge" in navigator) {
          await (navigator as any).setAppBadge(count);
        }
      } catch (_) {}
    })()
  );
});

// Manipulador acionado quando o usuário clica ou limpa notificações na Central de Ações do Windows
self.addEventListener("notificationclose", (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        const activeNotifs = await self.registration.getNotifications();
        if (activeNotifs.length === 0) {
          if ("clearAppBadge" in navigator) {
            await (navigator as any).clearAppBadge().catch(() => {});
          }
          if ("setAppBadge" in navigator) {
            await (navigator as any).setAppBadge(0).catch(() => {});
          }
        } else {
          if ("setAppBadge" in navigator) {
            await (navigator as any).setAppBadge(activeNotifs.length).catch(() => {});
          }
        }

        // Notifica todas as janelas ativas do app para sincronizar o contador interno
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: "NOTIFICATION_CLOSED_IN_OS",
            remaining: activeNotifs.length,
            closedTag: event.notification?.tag
          });
        }
      } catch (err) {
        console.warn("[SW] notificationclose sync error:", err);
      }
    })()
  );
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      // Atualiza o app badge após o fechamento desta notificação
      try {
        const activeNotifs = await self.registration.getNotifications();
        if (activeNotifs.length === 0) {
          if ("clearAppBadge" in navigator) {
            await (navigator as any).clearAppBadge().catch(() => {});
          }
          if ("setAppBadge" in navigator) {
            await (navigator as any).setAppBadge(0).catch(() => {});
          }
        } else {
          if ("setAppBadge" in navigator) {
            await (navigator as any).setAppBadge(activeNotifs.length).catch(() => {});
          }
        }
      } catch (_) {}

      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          try {
            client.postMessage({ type: 'NAVIGATE_URL', url: targetUrl });
          } catch (_) {}
          const focusedClient = await client.focus();
          if (focusedClient && 'navigate' in focusedClient) {
            return focusedClient.navigate(targetUrl);
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// Listener para sincronização direta de Badge via cliente
self.addEventListener("message", (event: any) => {
  if (!event.data) return;

  if (event.data.type === "CLEAR_APP_BADGE") {
    if ("clearAppBadge" in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
    if ("setAppBadge" in navigator) {
      (navigator as any).setAppBadge(0).catch(() => {});
    }
  } else if (event.data.type === "SYNC_APP_BADGE") {
    const count = Number(event.data.count) || 0;
    if (count <= 0) {
      if ("clearAppBadge" in navigator) {
        (navigator as any).clearAppBadge().catch(() => {});
      }
      if ("setAppBadge" in navigator) {
        (navigator as any).setAppBadge(0).catch(() => {});
      }
    } else {
      if ("setAppBadge" in navigator) {
        (navigator as any).setAppBadge(count).catch(() => {});
      }
    }
  }
});

