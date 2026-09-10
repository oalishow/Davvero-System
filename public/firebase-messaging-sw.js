// Firebase Cloud Messaging & Web Push Service Worker
// Garante recebimento e exibição de notificações com o aplicativo fechado e redirecionamento ao clicar

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let title = 'DAVVERO System';
  let body = 'Você recebeu uma nova notificação.';
  let url = '/';
  let icon = '/icon-192.png';
  let badge = '/icon-192.png';
  let tag = 'davvero-push-' + Date.now();

  try {
    const json = event.data.json();
    // Suporte a formatos FCM { notification, data } e formato plano WebPush
    title = json.title || json.notification?.title || title;
    body = json.body || json.message || json.notification?.body || body;
    url = json.url || json.data?.url || json.notification?.click_action || url;
    icon = json.icon || json.notification?.icon || icon;
    tag = json.tag || tag;
  } catch (_) {
    const text = event.data.text();
    if (text) body = text;
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
        console.warn("FCM push showNotification fallback:", err);
        await self.registration.showNotification(title, {
          body,
          data: { url }
        });
      }

      // Atualiza badge do app no sistema operacional
      try {
        const notifs = await self.registration.getNotifications();
        if ("setAppBadge" in navigator) {
          await navigator.setAppBadge(notifs.length).catch(() => {});
        }
      } catch (_) {}
    })()
  );
});

// Listener disparado quando o usuário descarta ou limpa a notificação na Central de Notificações do Windows / SO
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const activeNotifs = await self.registration.getNotifications();
        if (activeNotifs.length === 0) {
          if ("clearAppBadge" in navigator) {
            await navigator.clearAppBadge().catch(() => {});
          }
          if ("setAppBadge" in navigator) {
            await navigator.setAppBadge(0).catch(() => {});
          }
        } else {
          if ("setAppBadge" in navigator) {
            await navigator.setAppBadge(activeNotifs.length).catch(() => {});
          }
        }

        // Notifica todas as janelas do app para sincronizar e zerar/atualizar o contador
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windowClients) {
          client.postMessage({
            type: 'NOTIFICATION_CLOSED_IN_OS',
            remaining: activeNotifs.length,
            closedTag: event.notification?.tag
          });
        }
      } catch (err) {
        console.warn("[FCM-SW] notificationclose sync error:", err);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      // Sincroniza badge após o clique/fechamento
      try {
        const activeNotifs = await self.registration.getNotifications();
        if (activeNotifs.length === 0) {
          if ("clearAppBadge" in navigator) await navigator.clearAppBadge().catch(() => {});
          if ("setAppBadge" in navigator) await navigator.setAppBadge(0).catch(() => {});
        } else if ("setAppBadge" in navigator) {
          await navigator.setAppBadge(activeNotifs.length).catch(() => {});
        }
      } catch (_) {}

      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 1. Se já existir uma aba aberta, foca e redireciona para a URL do alerta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          try {
            client.postMessage({ type: 'NAVIGATE_URL', url: targetUrl });
            client.postMessage({ type: 'NOTIFICATION_CLOSED_IN_OS', remaining: 0 });
          } catch (_) {}
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'navigate' in focusedClient) {
              return focusedClient.navigate(targetUrl);
            }
          });
        }
      }

      // 2. Se o aplicativo estiver completamente fechado, abre uma nova janela na URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

