import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { DialogProvider } from './context/DialogContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { setupPWA } from './pwa';

// Suppress benign Vite WebSocket and network errors in preview/offline, and handle chunk reload errors smoothly
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reasonStr = event.reason
      ? (typeof event.reason === 'string' ? event.reason : event.reason?.message || '')
      : '';
    if (
      reasonStr.includes('WebSocket') ||
      reasonStr.includes('vite') ||
      reasonStr.includes('Failed to fetch') ||
      reasonStr.includes('NetworkError')
    ) {
      event.preventDefault();
    }

    // Se falhar ao buscar módulo dinâmico após nova publicação, recarregar suavemente uma única vez
    if (
      reasonStr.includes('dynamically imported module') ||
      reasonStr.includes('Loading chunk') ||
      reasonStr.includes('error loading dynamically imported module')
    ) {
      event.preventDefault();
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
    const msg = event?.message || '';
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported module')
    ) {
      event.preventDefault();
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
