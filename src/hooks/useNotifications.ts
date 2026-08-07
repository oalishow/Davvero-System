import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, appId, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { Notification } from '../types';

const NOTIF_CACHE_PREFIX = "notif_cache_";

export function useNotifications(recipientId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

  // Monitorar conexão para sincronização
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!recipientId || !isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      if (typeof window !== 'undefined' && 'clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(console.error);
      }
      return;
    }

    const cacheKey = `${NOTIF_CACHE_PREFIX}${recipientId}`;
    
    // Extracted logic to process and set notifications so we can reuse it
    const processNotifications = (rawNotifs: Notification[]) => {
      let localReads: string[] = [];
      let localCleared: string[] = [];
      try {
        localReads = JSON.parse(localStorage.getItem('davveroId_broadcast_reads') || '[]');
        localCleared = JSON.parse(localStorage.getItem('davveroId_cleared_notifs') || '[]');
      } catch (e) {}

      // Combinar estado de leitura local e filtragem de removidas
      let processed = rawNotifs
        .filter(n => !localCleared.includes(n.id))
        .map(n => {
          if (n.recipientId === "todos" && localReads.includes(n.id)) {
            return { ...n, read: true };
          }
          return n;
        });

      // Ordenar por data de criação descrescente
      processed.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setNotifications(processed);
      localStorage.setItem(cacheKey, JSON.stringify(processed));
      
      const unread = processed.filter(n => !n.read).length;
      setUnreadCount(unread);

      // Atualizar badge do PWA
      if (typeof window !== 'undefined' && 'setAppBadge' in navigator) {
        if (unread > 0) {
          navigator.setAppBadge(unread).catch(console.error);
        } else {
          navigator.clearAppBadge().catch(console.error);
        }
      }
    };

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
           // processed already 
           setNotifications(parsed);
           setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
        }
      } catch (err) {
        console.error("Erro ao carregar cache de notificações:", err);
      }
    }

    const q = query(
      collection(db, `artifacts/${appId}/public/data/notifications`),
      where("recipientId", "in", [recipientId, "todos"])
    );

    let lastSnapshotDocs: Notification[] = [];
    let initialLoad = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      lastSnapshotDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      
      if (!initialLoad && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        snapshot.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data() as Notification;
            
            // Check if it's already read locally (e.g. for broadcast)
            let isLocalRead = false;
            let isLocalCleared = false;
            try {
              const localReads = JSON.parse(localStorage.getItem('davveroId_broadcast_reads') || '[]');
              const localCleared = JSON.parse(localStorage.getItem('davveroId_cleared_notifs') || '[]');
              if (data.recipientId === "todos" && localReads.includes(change.doc.id)) {
                isLocalRead = true;
              }
              if (localCleared.includes(change.doc.id)) {
                isLocalCleared = true;
              }
            } catch (e) {}

            if (!data.read && !isLocalRead && !isLocalCleared) {
               const title = data.title || "Nova Notificação";
               const options = {
                 body: data.message,
                 icon: "/icon.svg",
                 tag: change.doc.id // Prevents duplicate notifications
               };

               if ('serviceWorker' in navigator) {
                 navigator.serviceWorker.ready.then(registration => {
                   registration.showNotification(title, options);
                 }).catch(() => {
                   try {
                     new Notification(title, options);
                   } catch (e) {
                     console.warn("Could not show notification via Service Worker or Constructor", e);
                   }
                 });
               } else {
                 try {
                   new Notification(title, options);
                 } catch (e) {
                   console.warn("Could not show notification via Constructor", e);
                 }
               }
            }
          }
        });
      }
      
      processNotifications(lastSnapshotDocs);
      initialLoad = false;
    }, (error) => {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
        console.error("Erro no snapshot de notificações:", error);
      }
    });

    const handleLocalUpdate = () => {
      // Re-process last known Firebase state with new local storage overrides
      processNotifications(lastSnapshotDocs);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('davveroId_notifs_local_update', handleLocalUpdate);
    }
    
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('davveroId_notifs_local_update', handleLocalUpdate);
      }
    };
  }, [recipientId, isAuthenticated]);

  return { notifications, unreadCount, isOnline };
}
