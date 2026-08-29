import { registerSW } from 'virtual:pwa-register';

let lastSwRefreshAttempt = 0;

export const setupPWA = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        // Remover apenas service workers verdadeiramente obsoletos
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (const registration of registrations) {
                if (registration.active && registration.active.scriptURL.includes('old-sw')) {
                    registration.unregister();
                    console.log("[PWA] Service worker legado desregistrado.");
                }
            }
        });

        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
                const now = Date.now();
                // Anti-loop safeguard: não forçar refresh contínuo do SW com menos de 30 segundos
                if (now - lastSwRefreshAttempt > 30000) {
                    lastSwRefreshAttempt = now;
                    console.log("[PWA] Novo conteúdo detectado no Service Worker. Atualizando com segurança...");
                    updateSW(true);
                }
            },
            onOfflineReady() {
                console.log("[PWA] Aplicativo pronto para funcionamento offline.");
            },
            onRegistered(r) {
                if (r) {
                    setInterval(() => {
                        r.update().catch(err => console.warn("[PWA] Verificação periódica do SW:", err));
                    }, 5 * 60 * 1000);
                }
            }
        });

        navigator.serviceWorker.ready.then((registration) => {
            registration.update().catch(err => console.warn("[PWA] Verificação inicial:", err));
        });
    }
};
