import { useState, useEffect } from "react";
import { db, auth, appId } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          setSubscription(sub);
        });
      });
    }
  }, []);

  const subscribe = async () => {
    try {
      if (!('Notification' in window)) {
        alert("Seu navegador não suporta Notificações Push ou você está rodando no painel (iFrame). Abra o app em uma nova guia para ativar.");
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        console.warn("User denied push notifications");
        alert("Permissão para notificações foi negada. Por favor, libere nas configurações do navegador (ícone de cadeado na barra de endereços).");
        return;
      }

      const response = await fetch("/api/push/public-key");
      const { publicKey } = await response.json();

      if (!publicKey) {
        console.error("VAPID Public Key not found");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Save to backend via Firestore Client SDK
      // Using btoa securely for subscription id
      const subJson = JSON.parse(JSON.stringify(sub));
      const subId = btoa(sub.endpoint).replace(/\+/g, '-').replace(/\//g, '_').substring(0, 100);
      
      // Use the root structure
      await setDoc(doc(db, "push_subscriptions", subId), {
        ...subJson,
        userId: auth.currentUser?.uid || "anonymous",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSubscription(sub);
      setPermission(Notification.permission);
      return sub;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      alert("Falha ao se inscrever nas notificações. Verifique a permissão do seu navegador.");
    }
  };

  const unsubscribe = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      setSubscription(null);
    }
  };

  return { isSupported, subscription, permission, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
