import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { DialogProvider } from './context/DialogContext';
import './index.css';
import { setupPWA } from './pwa';

// Suppress benign Vite WebSocket connection errors in AI Studio preview
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('WebSocket closed without opened')) {
    event.preventDefault();
  }
});

setupPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </SettingsProvider>
  </StrictMode>,
);
