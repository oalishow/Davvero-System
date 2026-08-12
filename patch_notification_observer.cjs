const fs = require('fs');
let file = fs.readFileSync('src/components/NotificationObserver.tsx', 'utf8');

const replacement = `import { useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useDobloMonitor } from '../hooks/useDobloMonitor';
import { messaging } from '../lib/firebase';
import { onMessage } from 'firebase/messaging';
import { useDialog } from '../context/DialogContext';

const STUDENT_BOND_KEY = 'davveroId_student_identity';
const STUDENT_TRACK_KEY = 'davveroId_student_track_ra';

export default function NotificationObserver() {
  const isMasterLogged = localStorage.getItem('adminMasterLogged') === 'true';
  const bondedId = localStorage.getItem(STUDENT_BOND_KEY) || localStorage.getItem(STUDENT_TRACK_KEY);
  
  // Determine recipient for notifications (admin or the specific student)
  const recipientId = isMasterLogged ? "admin" : bondedId ? bondedId : null;
  
  // Use the central hook that reads the 'notifications' collection and sets PWA Badge
  const { notifications, unreadCount } = useNotifications(recipientId);
  useDobloMonitor(recipientId);
  const { showAlert } = useDialog();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const checkFCMRegistration = async () => {
      try {
        if ('Notification' in window && Notification.permission === 'granted' && messaging) {
          // Listen for foreground messages
          unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received:', payload);
            // We could trigger a local toast here if needed
          });
        }
      } catch (err: any) {
        console.error("FCM Permission/Registration Error:", err);
        if (err.code === 'messaging/permission-blocked') {
           showAlert("As notificações foram bloqueadas no seu navegador. Por favor, libere a permissão nas configurações do site para receber avisos.", "error");
        } else if (err.code === 'messaging/unsupported-browser') {
           showAlert("Seu navegador não suporta as notificações em segundo plano do nosso sistema.", "error");
        } else {
           showAlert("Houve um erro ao conectar ao serviço de notificações: " + err.message, "error");
        }
      }
    };

    checkFCMRegistration();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [showAlert]);

  // For PWA Push / Badge sync
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(console.error);
      } else {
        navigator.clearAppBadge().catch(console.error);
      }
    }
  }, [unreadCount]);

  return null;
}
`;

fs.writeFileSync('src/components/NotificationObserver.tsx', replacement);
