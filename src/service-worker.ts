import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';

declare const self: any;

// Ativar e registrar imediatamente o novo service worker e assumir o controle dos clientes
self.skipWaiting();
clientsClaim();

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
try {
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [
      new RegExp('/__/'), // Exclude Firebase reserved URLs
      new RegExp('/api/'), // Exclude API routes
    ],
  });
  registerRoute(navigationRoute);
} catch (e) {
  console.log("Could not set up navigation fallback", e);
}

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

