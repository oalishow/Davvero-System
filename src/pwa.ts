import { registerSW } from 'virtual:pwa-register';

let lastSwRefreshAttempt = 0;
let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Triggers an immediate update check on the active ServiceWorker
 */
export const triggerSWCheck = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
    }
    try {
        if (swRegistration) {
            await swRegistration.update();
            return true;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
            swRegistration = reg;
            await reg.update();
            return true;
        }
    } catch (err) {
        console.warn("[PWA] Verificação sob demanda:", err);
    }
    return false;
};

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

        // Ouvinte de nova versão ativa para assumir o controle dos clientes
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            const now = Date.now();
            if (now - lastSwRefreshAttempt > 20000) {
                refreshing = true;
                lastSwRefreshAttempt = now;
                console.log("[PWA] Novo Service Worker ativo e controlando a página. Disparando evento de atualização...");
                window.dispatchEvent(new CustomEvent('swUpdated'));
            }
        });

        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
                const now = Date.now();
                // Anti-loop safeguard: não forçar refresh contínuo do SW com menos de 20 segundos
                if (now - lastSwRefreshAttempt > 20000) {
                    lastSwRefreshAttempt = now;
                    console.log("[PWA] Novo conteúdo detectado no Service Worker. Atualizando com segurança...");
                    window.dispatchEvent(new CustomEvent('swNeedRefresh'));
                    updateSW(true);
                }
            },
            onOfflineReady() {
                console.log("[PWA] Aplicativo pronto para funcionamento offline.");
            },
            onRegistered(r) {
                if (r) {
                    swRegistration = r;
                    // Verificação periódica a cada 45 segundos em segundo plano
                    setInterval(() => {
                        r.update().catch(err => console.warn("[PWA] Verificação periódica do SW:", err));
                    }, 45 * 1000);
                }
            }
        });

        navigator.serviceWorker.ready.then((registration) => {
            swRegistration = registration;
            registration.update().catch(err => console.warn("[PWA] Verificação inicial:", err));
        });

        // Verificação imediata ao retomar o foco da aba ou reconectar à internet
        const handleFocusOrOnline = () => {
            if (document.visibilityState === 'visible') {
                triggerSWCheck();
            }
        };

        window.addEventListener('focus', handleFocusOrOnline);
        document.addEventListener('visibilitychange', handleFocusOrOnline);
        window.addEventListener('online', handleFocusOrOnline);
    }
};
