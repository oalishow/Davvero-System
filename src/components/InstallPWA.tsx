import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Info, Share } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { APP_VERSION } from '../lib/constants';

export default function InstallPWA() {
  const { settings } = useSettings();
  const instNameShort = settings.instName?.split(' ')[0] || 'App';
  const isLandingMode = new URLSearchParams(window.location.search).get('install') === 'true';
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | 'samsung' | 'other'>('other');

  const [isInstalled, setIsInstalled] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Detect iframe
    setIsInIframe(window.self !== window.top);

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/samsungbrowser/.test(userAgent)) {
      setPlatform('samsung');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else if (/windows|macintosh|linux/.test(userAgent)) {
      setPlatform('desktop');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback navigation if prompt isn't ready
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('install', 'true');
      window.location.href = newUrl.toString();
      return;
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBtn(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Failed to prompt install:', err);
      // Fallback: clear the prompt so they can just use instructions
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  useEffect(() => {
    (window as any).triggerPWAInstall = handleInstallClick;
    return () => {
      delete (window as any).triggerPWAInstall;
    };
  }, [deferredPrompt, handleInstallClick]);

  if (isLandingMode && !window.matchMedia('(display-mode: standalone)').matches && !isInstalled) {
    return createPortal(
      <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animated-fade-in overflow-y-auto">
        <div className="w-full max-w-md bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.2)] p-8 text-center border border-white/50 dark:border-slate-500/30 my-auto relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

          {settings.instLogo ? (
            <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center animate-in zoom-in duration-500 hover:scale-105 transition-transform">
               <img src={settings.instLogo} alt="Logo" className="w-full h-full object-contain drop-shadow-2xl" />
            </div>
          ) : (
            <div className="relative w-24 h-24 bg-gradient-to-br from-sky-400 to-blue-600 rounded-[2rem] mx-auto mb-8 shadow-2xl shadow-sky-500/40 flex items-center justify-center rotate-3 transform hover:rotate-6 transition-transform">
               <Download className="w-12 h-12 text-white drop-shadow-md" />
            </div>
          )}
          <h2 className="relative text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Instalar DAVVERO System</h2>
          <p className="relative text-[10px] text-sky-700 dark:text-sky-300 mb-8 uppercase tracking-[0.2em] font-black bg-sky-100/50 dark:bg-sky-500/10 py-1.5 px-3 rounded-full inline-block border border-sky-200/50 dark:border-sky-500/20 shadow-sm">
            DAVVERO System v{APP_VERSION}
          </p>
          
          <div className="relative space-y-4 mb-8">
            {showInstallBtn ? (
              <button 
                onClick={handleInstallClick}
                className="w-full py-4 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl text-base font-bold shadow-xl shadow-sky-600/30 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <Download className="w-5 h-5 relative z-10" />
                <span className="relative z-10">INSTALAR AGORA</span>
              </button>
            ) : platform === 'ios' ? (
              <div className="bg-sky-50/80 dark:bg-sky-900/40 p-6 rounded-3xl border border-sky-100 dark:border-sky-500/30 text-left shadow-sm backdrop-blur-sm">
                <p className="text-sm font-bold text-sky-900 dark:text-sky-300 mb-3 flex items-center gap-3">
                  <span className="bg-sky-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md shadow-sky-600/30">1</span> 
                  Safari (iPhone)
                </p>
                <p className="text-sm text-sky-800/80 dark:text-sky-200/80 leading-relaxed font-medium">
                  Toque no ícone de <strong>Compartilhar</strong> na barra inferior e escolha <strong>"Adicionar à Tela de Início"</strong>.
                </p>
              </div>
            ) : platform === 'samsung' ? (
              <div className="bg-sky-50/80 dark:bg-sky-900/40 p-6 rounded-3xl border border-sky-100 dark:border-sky-500/30 text-left shadow-sm backdrop-blur-sm">
                <p className="text-sm font-bold text-sky-900 dark:text-sky-300 mb-3 flex items-center gap-3">
                  <span className="bg-sky-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md shadow-sky-600/30">1</span> 
                  Samsung Internet
                </p>
                <p className="text-sm text-sky-800/80 dark:text-sky-200/80 leading-relaxed font-medium">
                  Toque no ícone <strong>+</strong> na barra de endereços ou abra o menu e escolha <strong>"Adicionar página a: Tela inicial"</strong>.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50/80 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-left shadow-sm backdrop-blur-sm">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-3">
                  <span className="bg-slate-800 dark:bg-slate-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md shadow-slate-800/30">!</span> 
                  Instalação Manual
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Abra o menu do seu navegador (⋮) e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela de início"</strong>.
                </p>
              </div>
            )}
            
            <button 
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('install');
                window.history.replaceState({}, '', url);
                window.location.reload();
              }}
              className="w-full py-4 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-[0.1em] hover:text-slate-600 dark:hover:text-slate-300 transition-colors mt-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl"
            >
              Continuar sem instalar
            </button>
          </div>
          
          <div className="relative pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
             <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 font-medium max-w-[280px] mx-auto">
                Ao instalar, o aplicativo ganha <span className="font-bold text-slate-500 dark:text-slate-400">melhor performance</span> e permite o <span className="font-bold text-slate-500 dark:text-slate-400">uso offline</span> da sua ID.
             </p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (isInIframe && !isInstalled) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4 rounded-2xl mt-6 no-print">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Para Instalar no PC</h3>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              O botão de instalação não funciona dentro da barra lateral. Por favor, <strong>abra o aplicativo em uma nova aba</strong> (clicando no botão de seta no topo da barra lateral) para poder instalar como programa no Windows.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="bg-sky-600 text-white p-4 rounded-2xl mt-6 no-print shadow-lg animate-bounce">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Instalado com Sucesso!</h3>
              <p className="text-[10px] opacity-90 uppercase font-black">Procure o ícone na sua tela inicial e abra por lá.</p>
            </div>
         </div>
      </div>
    );
  }

  if (platform === 'ios' && !window.matchMedia('(display-mode: standalone)').matches) {
    return (
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-4 rounded-2xl mt-6 no-print">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-sky-100 dark:bg-sky-800 rounded-lg text-sky-600 dark:text-sky-300">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-sky-900 dark:text-sky-100 mb-1">Instalar no iPhone</h3>
            <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
              Para instalar o <strong>DAVVERO System</strong>, toque no ícone de <span className="inline-block"><Share className="w-4 h-4 mx-0.5 inline" /></span> <strong>Compartilhar</strong> do seu Safari e selecione <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'samsung' && !showInstallBtn && !window.matchMedia('(display-mode: standalone)').matches) {
    return (
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-4 rounded-2xl mt-6 no-print">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-sky-100 dark:bg-sky-800 rounded-lg text-sky-600 dark:text-sky-300">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-sky-900 dark:text-sky-100 mb-1">Instalar no Samsung Internet</h3>
            <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed font-medium">
              No Samsung Internet, toque no ícone de <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] inline-block font-bold">+</span > na barra de endereços ou abra o menu (≡) → <strong>Adicionar página a</strong> → <strong>Tela inicial</strong> para instalar o DAVVERO System.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!showInstallBtn) {
    // Se não houver prompt automático (comum em muitos navegadores mobile ou quando já recusado)
    // Mostramos instruções genéricas se não estiver em modo standalone
    if (!window.matchMedia('(display-mode: standalone)').matches && !isInIframe) {
      return (
        <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl mt-6 no-print">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Como Instalar</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Para rodar como aplicativo (PWA): no <strong>Chrome</strong> ou <strong>Edge</strong>, clique nos <strong>três pontos (⋮)</strong> e procure por <strong>"Instalar aplicativo"</strong>. Em outros navegadores, procure no menu a opção <strong>"Adicionar à tela de início"</strong>.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 rounded-2xl mt-6 no-print">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-300">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Instalar Aplicativo</h3>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-semibold">
              {platform === 'desktop' ? 'Versão para Windows/PC' : 'DAVVERO System native web app'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleInstallClick}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
        >
          Instalar Agora
        </button>
      </div>
    </div>
  );
}
