import { useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useDobloMonitor } from '../hooks/useDobloMonitor';
import { messaging } from '../lib/firebase';
import { onMessage } from 'firebase/messaging';

const STUDENT_BOND_KEY = 'davveroId_student_identity';
const STUDENT_TRACK_KEY = 'davveroId_student_track_ra';

/**
 * NotificationObserver
 * Observador global não-bloqueante para monitoramento de notificações in-app,
 * badges PWA e recebimento de mensagens FCM em primeiro plano.
 *
 * Princípios de resiliência:
 * 1. Inicialização 100% assíncrona e desacoplada do ciclo de renderização inicial.
 * 2. Não dispara alertas intrusivos no startup da aplicação caso permissões estejam pendentes.
 * 3. Trata falhas de Service Worker e FCM silenciosamente sem travar navegação ou login.
 */
export default function NotificationObserver() {
  const isMasterLogged = typeof window !== 'undefined' && localStorage.getItem('adminMasterLogged') === 'true';
  const bondedId = typeof window !== 'undefined' ? localStorage.getItem(STUDENT_BOND_KEY) : null;
  const trackRa = typeof window !== 'undefined' ? localStorage.getItem(STUDENT_TRACK_KEY) : null;
  const docId = typeof window !== 'undefined' ? localStorage.getItem('davveroId_student_doc_id') : null;
  
  // Determine recipient identifiers for notifications (admin, student docId, alphaCode, RA)
  const recipientIds: string[] = [];
  if (isMasterLogged) {
    recipientIds.push("admin");
  }
  if (bondedId) {
    recipientIds.push(bondedId);
  }
  if (trackRa && !recipientIds.includes(trackRa)) {
    recipientIds.push(trackRa);
  }
  if (docId && !recipientIds.includes(docId)) {
    recipientIds.push(docId);
  }
  
  // Hook central que escuta as notificações do Firestore e gerencia badges
  const { unreadCount } = useNotifications(recipientIds.length > 0 ? recipientIds : null);
  useDobloMonitor(bondedId || trackRa || null);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setupForegroundMessaging = async () => {
      try {
        // Checagem segura de suporte às APIs do navegador
        if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
          return;
        }

        // Se a permissão não foi concedida explicitamente, não force nem bloqueie nada no startup
        if (Notification.permission !== 'granted') {
          return;
        }

        // Aguardar o Service Worker estar pronto de forma assíncrona
        try {
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn("[NotificationObserver] Service Worker não respondeu a tempo:", swErr);
          return;
        }

        if (!isMounted) return;

        // Registrar listener de mensagens em primeiro plano apenas se o messaging estiver instanciado
        if (messaging) {
          unsubRef.current = onMessage(messaging, (payload) => {
            console.log('[NotificationObserver] Mensagem em primeiro plano recebida:', payload);
            
            // Disparar evento personalizado para componentes interessados
            try {
              window.dispatchEvent(new CustomEvent('davvero_fcm_foreground_message', { detail: payload }));
            } catch (evErr) {
              console.warn("[NotificationObserver] Erro ao despachar evento customizado:", evErr);
            }
          });
        }
      } catch (err: any) {
        // Apenas log de aviso no console; nunca bloquear a experiência do usuário ou interromper o app
        console.warn("[NotificationObserver] Inicialização não-bloqueante do FCM:", err?.message || err);
      }
    };

    // Executar após uma pequena folga para priorizar a renderização principal
    const timer = setTimeout(() => {
      setupForegroundMessaging();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (unsubRef.current) {
        try {
          unsubRef.current();
        } catch (unsubErr) {
          console.warn("[NotificationObserver] Erro ao desinscrever FCM listener:", unsubErr);
        }
      }
    };
  }, []);

  // For PWA Push / Badge sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }, [unreadCount]);

  return null;
}
