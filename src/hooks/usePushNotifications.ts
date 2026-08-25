import { useState, useEffect } from "react";
import { db, auth, messaging } from "../lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { getToken, onMessage, deleteToken } from "firebase/messaging";

// You should put your FCM VAPID Key here.
// You can get this from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates.


export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check if running in browser and if it supports Notification
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // If permission is already granted, we can try to retrieve the existing token from local storage
      const existingToken = localStorage.getItem("fcm_token");
      if (existingToken) {
         setToken(existingToken);
      }
    }
  }, []);

  const subscribe = async () => {
    if (!messaging) {
      alert("Firebase Messaging não inicializado.");
      return;
    }
    try {
      if (!('Notification' in window)) {
        alert("Seu navegador não suporta Notificações Push ou você está rodando no painel. Tente adicionar o site à tela inicial (PWA).");
        return;
      }
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        console.warn("User denied push notifications");
        alert("Permissão para notificações foi negada.");
        return;
      }

      // Try to get token. Wait for SW to be ready first.
      const registration = await navigator.serviceWorker.ready;
      
      let fcmToken = null;
      let publicKey = "";
      
      try {
        const response = await fetch("/api/push/public-key");
        if (response.ok) {
          const data = await response.json();
          publicKey = data.publicKey || "";
        }
      } catch (keyErr) {
        console.warn("Could not fetch public key from server:", keyErr);
      }

      try {
        const tokenOptions: { vapidKey?: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = {
          serviceWorkerRegistration: registration,
        };
        if (publicKey && publicKey.trim().length > 0) {
          tokenOptions.vapidKey = publicKey.trim();
        }

        fcmToken = await getToken(messaging, tokenOptions);
      } catch (err: any) {
        console.error("FCM Token error:", err);
        // If error was related to invalid VAPID, attempt without vapidKey fallback
        if (publicKey) {
          try {
            console.log("Tentando fallback sem VAPID...");
            fcmToken = await getToken(messaging, { serviceWorkerRegistration: registration });
          } catch (fallbackErr) {
            console.error("Fallback sem VAPID também falhou:", fallbackErr);
          }
        }
        
        if (!fcmToken) {
          alert(`Não foi possível ativar as notificações push do Firebase (${err?.message || 'Verifique as permissões ou chaves de mensageria'}).`);
          return;
        }
      }

      if (fcmToken) {
        setToken(fcmToken);
        localStorage.setItem("fcm_token", fcmToken);

        // Save token to backend via Firestore
        const userId = auth.currentUser?.uid || "anonymous";
        await setDoc(doc(db, "fcm_tokens", fcmToken), {
          token: fcmToken,
          userId,
          device: navigator.userAgent,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        return fcmToken;
      } else {
        alert("Não foi possível gerar o token de notificação.");
      }
    } catch (error) {
      console.error("Error subscribing to push:", error);
      alert("Falha ao se inscrever nas notificações. Verifique a permissão do seu navegador.");
    }
  };

  const unsubscribe = async () => {
    if (token && messaging) {
      try {
        await deleteToken(messaging);
        await deleteDoc(doc(db, "fcm_tokens", token));
      } catch (err) {
        console.error("Error unsubscribing", err);
      }
      setToken(null);
      localStorage.removeItem("fcm_token");
    }
  };

  return { isSupported, subscription: token ? { endpoint: token } : null, permission, subscribe, unsubscribe };
}
