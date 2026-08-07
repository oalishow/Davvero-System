import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, limit } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';

export function useDobloMonitor(bondedId: string | null) {
  const notifiedSet = useRef<Set<string>>(new Set());
  const [authorId, setAuthorId] = useState<string | null>(null);

  useEffect(() => {
    if (!bondedId || bondedId === "admin") return;

    // Resolve bondedId to doc id (authorId)
    const resolveBondedId = async () => {
      try {
        const docSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, bondedId));
        if (docSnap.exists()) {
          setAuthorId(docSnap.id);
          return;
        }
        const q = query(collection(db, `artifacts/${appId}/public/data/students`), where("alphaCode", "==", bondedId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setAuthorId(snap.docs[0].id);
        }
      } catch (e) {}
    };

    resolveBondedId();
  }, [bondedId]);

  useEffect(() => {
    if (!authorId) return;

    const q = query(
      collection(db, `artifacts/${appId}/public/data/doblo_logs`),
      where("authorId", "==", authorId),
      where("arrivalTime", "==", "")
    );

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(q, (snapshot) => {
        const pendingLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const checkLogs = () => {
          const now = new Date();
          
          pendingLogs.forEach(log => {
            if (!log.date || !log.departureTime) return;
            if (log.deletedAt) return; // Ignore deleted logs
            
            const logDate = new Date(`${log.date}T${log.departureTime}`);
            if (isNaN(logDate.getTime())) return;

            const diffHours = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60);

            if (diffHours >= 2 && !notifiedSet.current.has(log.id)) {
              notifiedSet.current.add(log.id);
              if (Notification.permission === 'granted') {
                new Notification('Doblô: Viagem pendente', {
                  body: `Você esqueceu de finalizar o registro de viagem da Doblô iniciada às ${log.departureTime}.`,
                  icon: '/icon-192.png'
                });
              } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                    new Notification('Doblô: Viagem pendente', {
                      body: `Você esqueceu de finalizar o registro de viagem da Doblô iniciada às ${log.departureTime}.`,
                      icon: '/icon-192.png'
                    });
                  }
                });
              }
            }
          });
        };

        checkLogs();
        const interval = setInterval(checkLogs, 60000);

        return () => clearInterval(interval);
      });
    } catch (e) {
      console.error("Error monitoring doblo logs", e);
    }

    return () => {
      unsubscribe();
    };
  }, [authorId]);
}
