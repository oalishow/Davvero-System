importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAldUSOslWbr9sTvg0ePP-8K0A2eBOuHOg",
  authDomain: "banco-de-dados-fajopa.firebaseapp.com",
  projectId: "banco-de-dados-fajopa",
  storageBucket: "banco-de-dados-fajopa.appspot.com",
  messagingSenderId: "477906925599",
  appId: "1:477906925599:web:4cdd41bb61493c1b65bd2a",
  measurementId: "G-L236SXBHC4",
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload?.notification?.title || payload?.data?.title || 'DAVVERO Notificação';
    const notificationOptions = {
      body: payload?.notification?.body || payload?.data?.message || 'Você recebeu um comunicado.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: {
        url: payload?.data?.url || '/'
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Firebase init in SW:', e);
}

// Native WebPush fallback handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'DAVVERO System';
    const options = {
      body: data.message || data.body || 'Nova notificação recebida',
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('DAVVERO System', {
        body: text,
        icon: '/logo192.png',
        badge: '/logo192.png'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
