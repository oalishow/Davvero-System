import { registerSW } from 'virtual:pwa-register';

export const setupPWA = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        // Remover apenas service workers verdadeiramente obsoletos
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (let registration of registrations) {
                if (registration.active && registration.active.scriptURL.includes('old-sw')) {
                    registration.unregister();
                    console.log("Service worker antigo desregistrado.");
                }
            }
        });

        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
                console.log("Novo conteúdo detectado no Service Worker. Forçando atualização...");
                updateSW(true);
            },
            onOfflineReady() {
                console.log("Aplicativo pronto para funcionamento offline.");
            },
            onRegistered(r) {
                if (r) {
                    setInterval(() => {
                        r.update().catch(err => console.warn("Erro na verificação periódica do SW:", err));
                    }, 2 * 60 * 1000);
                }
            }
        });

        navigator.serviceWorker.ready.then((registration) => {
            registration.update().catch(err => console.warn("Erro ao buscar atualizações no carregamento:", err));

            window.addEventListener('focus', () => {
                registration.update().catch(err => console.warn("Erro ao buscar atualizações ao focar a tela:", err));
            });

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    registration.update().catch(err => console.warn("Erro ao buscar atualizações ao retomar visibilidade:", err));
                }
            });
        });
    }
};
