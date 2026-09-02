import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { DialogProvider } from './context/DialogContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { setupPWA } from './pwa';

// Suppress benign Vite WebSocket and network errors in preview/offline
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
