import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy import with automatic retry on dynamic import chunk errors
 * (common after new deployments or dev server reloads).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  maxRetries = 3,
  initialInterval = 600
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = (retriesLeft: number, delay: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            console.warn(`[lazyWithRetry] Falha ao importar módulo (${retriesLeft} tentativas restantes):`, error?.message || error);
            if (retriesLeft > 0) {
              setTimeout(() => {
                attemptImport(retriesLeft - 1, Math.min(delay * 1.5, 3000));
              }, delay);
              return;
            }

            const isChunkError =
              error?.name === 'ChunkLoadError' ||
              error?.message?.includes('dynamically imported module') ||
              error?.message?.includes('Failed to fetch') ||
              error?.message?.includes('Loading chunk');

            // CRÍTICO: Nunca recarregar a página se o usuário estiver offline, pois isso exibe o erro nativo do navegador "Não foi possível acessar esse site"
            const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

            if (isChunkError && isOnline && typeof window !== 'undefined') {
              const key = 'chunk_reload_attempt';
              const lastAttempt = sessionStorage.getItem(key);
              const now = Date.now();
              // Anti-loop: don't reload if done within the last 15 seconds
              if (!lastAttempt || now - parseInt(lastAttempt, 10) > 15000) {
                sessionStorage.setItem(key, now.toString());
                console.info("[lazyWithRetry] Recarregando para obter nova versão dos módulos...");
                window.location.reload();
                return;
              }
            }

            reject(error);
          });
      };

      attemptImport(maxRetries, initialInterval);
    })
  );
}
