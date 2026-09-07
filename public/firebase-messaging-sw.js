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
    self.registration.showNotification(title, options).catch((err) => {
      console.warn("FCM push showNotification fallback:", err);
      return self.registration.showNotification(title, {
        body,
        data: { url }
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Se já existir uma aba aberta, foca e redireciona para a URL do alerta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          try {
            client.postMessage({ type: 'NAVIGATE_URL', url: targetUrl });
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
    })
  );
});

