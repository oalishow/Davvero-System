const fs = require('fs');
let file = fs.readFileSync('src/hooks/usePushNotifications.ts', 'utf8');

file = file.replace(
  'const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || "BE_YOUR_VAPID_KEY_HERE"; ',
  ''
);

file = file.replace(
  `      try {
        fcmToken = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration 
        });
      } catch (err: any) {`,
  `      try {
        const response = await fetch("/api/push/public-key");
        const { publicKey } = await response.json();
        
        fcmToken = await getToken(messaging, { 
          vapidKey: publicKey,
          serviceWorkerRegistration: registration 
        });
      } catch (err: any) {`
);

fs.writeFileSync('src/hooks/usePushNotifications.ts', file);
