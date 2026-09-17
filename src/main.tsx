import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { DialogProvider } from './context/DialogContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { setupPWA } from './pwa';

// Global protection against benign permission-denied / offline noise in preview
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  const isPermissionDenied = args.some((arg) => {
    if (!arg) return false;
    const str = typeof arg === "string" ? arg : (arg?.message || (typeof arg?.toString === "function" ? arg.toString() : "") || JSON.stringify(arg) || "");
    return (
      str.includes("Missing or insufficient permissions") ||
      str.includes("permission-denied") ||
      str.includes("insufficient permissions")
    );
  });

  if (isPermissionDenied) {
    console.warn(...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

// Suppress benign Vite WebSocket and network errors in preview/offline, and handle chunk reload errors smoothly
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reasonStr = event.reason
      ? (typeof event.reason === 'string' ? event.reason : event.reason?.message || '')
      : '';
    if (
      reasonStr.includes('Missing or insufficient permissions') ||
      reasonStr.includes('permission-denied') ||
      reasonStr.includes('insufficient permissions') ||
      reasonStr.includes('WebSocket') ||
      reasonStr.includes('vite') ||
      reasonStr.includes('Failed to fetch') ||
      reasonStr.includes('NetworkError')
    ) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      return;
    }

    // Se falhar ao buscar módulo dinâmico após nova publicação, recarregar suavemente apenas se estiver ONLINE
    if (
      reasonStr.includes('dynamically imported module') ||
      reasonStr.includes('Loading chunk') ||
      reasonStr.includes('error loading dynamically imported module')
    ) {
      event.preventDefault();
      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!isOnline) {
        console.warn('[main] Falha de import dinâmico em modo offline; reload suprimido.');
        return;
      }
      const last = sessionStorage.getItem('global_chunk_recover_ts');
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 12000) {
        sessionStorage.setItem('global_chunk_recover_ts', String(now));
        window.location.replace(window.location.origin + window.location.pathname + '?_upd=' + now);
      }
    }
  } catch (e) {}
});

// Capturar erros globais síncronos de carregamento de scripts obsoletos
window.addEventListener('error', (event) => {
  try {
    const msg = (event?.message || (event?.error && event.error.message)) || '';
    if (
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('permission-denied') ||
      msg.includes('insufficient permissions')
    ) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      return;
    }

    if (
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported module')
    ) {
      event.preventDefault();
      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!isOnline) {
        console.warn('[main] Erro de chunk de script em modo offline; reload suprimido.');
        return;
      }
      const last = sessionStorage.getItem('global_chunk_recover_ts');
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 12000) {
        sessionStorage.setItem('global_chunk_recover_ts', String(now));
        window.location.replace(window.location.origin + window.location.pathname + '?_upd=' + now);
      }
    }
  } catch (e) {}
});

setupPWA();

// Desabilitar zoom de pinça (pinch-to-zoom) no Safari iOS, Chrome e navegadores móveis para manter o app perfeitamente ajustado à tela
if (typeof window !== 'undefined') {
  const preventPinch = (e: Event) => {
    if (!(e.target as HTMLElement)?.closest?.('.reactEasyCrop_Container')) {
      e.preventDefault();
    }
  };
  document.addEventListener('gesturestart', preventPinch, { passive: false });
  document.addEventListener('gesturechange', preventPinch, { passive: false });
  document.addEventListener('gestureend', preventPinch, { passive: false });
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1 && !(e.target as HTMLElement)?.closest?.('.reactEasyCrop_Container')) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
