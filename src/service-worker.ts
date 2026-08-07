import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { clientsClaim } from 'workbox-core';

declare const self: any;

// Ativar e registrar imediatamente o novo service worker e assumir o controle dos clientes
self.skipWaiting();
clientsClaim();

// Ouvinte para mensagens de SKIP_WAITING enviadas pelo aplicativo cliente
self.addEventListener('message', (event: any) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
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
    ],
  });
  registerRoute(navigationRoute);
} catch (e) {
  console.log("Could not set up navigation fallback", e);
}

// Background Sync para operações Firestore offline
const bgSyncPlugin = new BackgroundSyncPlugin('firestore-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 Hours (specified in minutes)
});

// Cache para chamadas do Firestore e APIs (Dados básicos)
registerRoute(
  ({ url }) => url.origin.includes('firestore.googleapis.com'),
  new NetworkFirst({
    cacheName: 'firestore-data-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
      bgSyncPlugin,
    ]
  })
);

// Cache para imagens profile/eventos
registerRoute(
  ({ request, url }) => request.destination === 'image' || url.origin.includes('firebasestorage.googleapis.com'),
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
  const data = event.data ? event.data.json() : { title: "Nova Notificação", body: "Você recebeu uma mensagem." };

  const options = {
    body: data.body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any[]) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (windowClients.length > 0 && 'focus' in windowClients[0]) {
        return windowClients[0].focus().then((client: any) => {
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        });
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
