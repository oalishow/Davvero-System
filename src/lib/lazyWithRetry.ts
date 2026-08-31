import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy import with automatic retry on dynamic import chunk errors
 * (common after new deployments or dev server reloads).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retriesLeft = 2,
  interval = 1000
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      componentImport()
        .then(resolve)
        .catch((error) => {
          if (retriesLeft > 0) {
            setTimeout(() => {
              lazyWithRetry(componentImport, retriesLeft - 1, interval);
              componentImport().then(resolve).catch(reject);
            }, interval);
            return;
          }

          const isChunkError =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('dynamically imported module') ||
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Loading chunk');

          if (isChunkError && typeof window !== 'undefined') {
            const key = 'chunk_reload_attempt';
            const lastAttempt = sessionStorage.getItem(key);
            const now = Date.now();
            if (!lastAttempt || now - parseInt(lastAttempt, 10) > 15000) {
              sessionStorage.setItem(key, now.toString());
              window.location.reload();
              return;
            }
          }

          reject(error);
        });
    })
  );
}
