import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';

declare const self: any;

// Ativar e registrar imediatamente o novo service worker e assumir o controle dos clientes
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Garantir que a casca da aplicação (App Shell) esteja permanentemente em cache dedicado
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open('app-shell-cache');
        await cache.addAll(['/', '/index.html']);
      } catch (e) {
        console.warn('[SW] Pré-cache de contingência do app-shell finalizado com aviso:', e);
      }
    })()
  );
});

// Limpar caches antigos ou conflitantes (como o de chamadas streaming do Firestore)
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    (async () => {
      try {
        if ('caches' in self) {
          await caches.delete('firestore-data-cache');
        }
      } catch (_) {}
    })()
  );
});

// Ouvinte para mensagens de SKIP_WAITING enviadas pelo aplicativo cliente
self.addEventListener('message', (event: any) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING' || event.data?.type === 'CHECK_UPDATE')) {
    self.skipWaiting();
  }
});

precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell / Navigation Fallback
// This allows the app to work offline for all navigation requests (SPA)
const getIndexHtmlHandler = () => {
  try {
    return createHandlerBoundToURL('index.html');
  } catch (_) {
    try {
      return createHandlerBoundToURL('/index.html');
    } catch (e) {
      console.warn("Could not createHandlerBoundToURL for index.html:", e);
      return null;
    }
  }
};

const navigationHandler = getIndexHtmlHandler();
if (navigationHandler) {
  try {
    const navigationRoute = new NavigationRoute(navigationHandler, {
      denylist: [
        new RegExp('/__/'), // Exclude Firebase reserved URLs
        new RegExp('/api/'), // Exclude API routes
      ],
    });
    registerRoute(navigationRoute);
  } catch (e) {
    console.warn("Could not register NavigationRoute:", e);
  }
}

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
          (await caches.match('/', { cacheName: 'app-shell-cache' })) ||
          (await caches.match('/index.html', { cacheName: 'app-shell-cache' }));
        if (cached) return cached;
      }
      return await fetch(request);
    } catch {
      const fallback =
        (await matchPrecache('index.html')) ||
        (await matchPrecache('/index.html')) ||
        (await caches.match('index.html')) ||
        (await caches.match('/index.html')) ||
        (await caches.match('/', { cacheName: 'app-shell-cache' })) ||
        (await caches.match('/index.html', { cacheName: 'app-shell-cache' }));
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
      (await caches.match('/', { cacheName: 'app-shell-cache' })) ||
      (await caches.match('/index.html', { cacheName: 'app-shell-cache' }));
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
    cacheName: 'static-assets-cache',
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

