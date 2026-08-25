import { registerSW } from 'virtual:pwa-register';

export const setupPWA = () => {
    if ('serviceWorker' in navigator) {
        // Remover service workers legados/antigos para evitar qualquer travamento de versão
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (let registration of registrations) {
                if (registration.active && (registration.active.scriptURL.includes('/sw.js') || registration.active.scriptURL.includes('old-sw'))) {
                    registration.unregister();
                    console.log("Service worker antigo desregistrado para evitar execução de versões obsoletas.");
                }
            }
        });

        const updateSW = registerSW({
            immediate: true,
            onNeedRefresh() {
                console.log("Novo conteúdo detectado no Service Worker. Forçando atualização imediata...");
                updateSW(true);
            },
            onOfflineReady() {
                console.log("Aplicativo pronto para funcionamento offline na versão atual.");
            },
            onRegistered(r) {
                if (r) {
                    // Verificar por nova versão a cada 2 minutos
                    setInterval(() => {
                        r.update().catch(err => console.warn("Erro na verificação periódica do SW:", err));
                    }, 2 * 60 * 1000);
                }
            }
        });

        // Procurar por atualizações proativamente ao iniciar e ao focar
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

        // Ouvinte de mudança de controlador: Recarrega a página assim que o novo SW estiver ativo
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            console.log("Novo Service Worker assumiu o controle. Recarregando página para a versão mais recente...");
            window.location.reload();
        });
    }
};
