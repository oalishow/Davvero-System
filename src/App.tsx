import { useState, useEffect, lazy, Suspense } from "react";
import { Wrench } from "lucide-react";
import { useDialog } from "./context/DialogContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import {
  Moon,
  Sun,
  Shield,
  User,
  Lock,
  Loader2,
  Sparkles,
  RefreshCw,
  X,
  Calendar,
  BookHeart,
  MonitorPlay,
  Facebook,
  Instagram,
  Youtube,
  BookOpen,
  MessageCircle,
  Mail,
  HeartHandshake
} from "lucide-react";
import LiturgyPanel from "./components/LiturgyPanel";
import { loginAnon, testConnection } from "./lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import ErrorBoundary from "./components/ErrorBoundary";
import DynamicPWA from "./components/DynamicPWA";
import NotificationObserver from "./components/NotificationObserver";
import { useSettings } from "./context/SettingsContext";
import { APP_VERSION, CHANGELOG } from "./lib/constants";
import { playSound } from "./lib/sounds";

const Verifier = lazy(() => import("./components/Verifier"));
const Admin = lazy(() => import("./components/Admin"));
const StudentPortal = lazy(() => import("./components/StudentPortal"));
const EventsPage = lazy(() => import("./components/EventsPage"));
const MuralPage = lazy(() => import("./components/MuralPage"));
const PublicAppointmentsList = lazy(() => import("./components/PublicAppointmentsList"));
const WelcomeModal = lazy(() => import("./components/WelcomeModal"));

export default function App() {
  const { settings } = useSettings();
  const { showAlert } = useDialog();
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    return localStorage.getItem("has_seen_welcome") !== "true";
  });
  const [activeTab, setActiveTab] = useState<
    "verifier" | "admin" | "student" | "events" | "liturgy" | "mural" | "appointments"
  >(() => {
    // Only access window parameters on component mount
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("event")) {
        return "events";
      }
    }
    return "verifier";
  });
  const [targetVerifyCode, setTargetVerifyCode] = useState<string | null>(null);
  const [adminForceViewCode, setAdminForceViewCode] = useState<string | null>(
    null,
  );
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "success">("idle");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [targetVersionText, setTargetVersionText] = useState("");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]') || target.closest('input[type="checkbox"]')) {
        playSound('pop');
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem("last_seen_app_version");
    
    // Mostra o modal de novidades se o app já estava instalado e agora é uma versão mais nova
    if (!lastSeenVersion) {
      localStorage.setItem("last_seen_app_version", APP_VERSION);
    } else if (lastSeenVersion !== APP_VERSION) {
      setShowUpdateModal(true);
    }

    localStorage.setItem("app_version", APP_VERSION);

    // Verificação via servidor para forçar a limpeza de cache se estamos usando versão antiga
    fetch(`/api/version?t=${new Date().getTime()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.version && data.version !== APP_VERSION) {
          const attemptKey = `update_attempted_${data.version}`;
          const lastAttemptTimeStr = localStorage.getItem(`update_attempt_time_${data.version}`);
          const lastAttemptTime = lastAttemptTimeStr ? parseInt(lastAttemptTimeStr, 10) : 0;
          
          // Se tentamos atualizar há menos de 1 minuto e falhou, não vamos tentar de novo num loop infinito
          if (localStorage.getItem(attemptKey) && (Date.now() - lastAttemptTime) < 60000) {
             console.log(`Atualização para ${data.version} tentada recentemente. Prevenindo loop.`);
             return;
          }

          console.log(`Versão obsoleta (Local: ${APP_VERSION}, Server: ${data.version}). Limpando cache e recarregando.`);
          setIsUpdating(true);
          setTargetVersionText(data.version);
          localStorage.setItem(attemptKey, "true");
          localStorage.setItem(`update_attempt_time_${data.version}`, Date.now().toString());
          
          let progress = 0;
          const progressInterval = setInterval(() => {
            progress += 5;
            if (progress <= 95) {
              setUpdateProgress(progress);
            }
          }, 150);

          setTimeout(async () => {
            try {
              if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                  await registration.unregister();
                }
              }
              if ('caches' in window) {
                 const keys = await caches.keys();
                 for (const key of keys) {
                     await caches.delete(key);
                 }
              }
            } catch (e) {
              console.error('Falha ao limpar caches', e);
            }
            clearInterval(progressInterval);
            setUpdateProgress(100);
            
            setTimeout(() => {
              window.location.href = window.location.pathname + '?v=' + new Date().getTime();
            }, 600);
          }, 3000);
        }
      })
      .catch(() => console.log("Não foi possível verificar versão com servidor"));
  }, []);

  const handleGlobalVerify = (code: string) => {
    setTargetVerifyCode(code);
    setActiveTab("verifier");
  };

  const handleAdminForceView = (code: string) => {
    setAdminForceViewCode(code);
    setActiveTab("student");
  };

  const handleUpdateClick = () => {
    setUpdateStatus("success");
    localStorage.setItem("last_seen_app_version", APP_VERSION);

    // Um pouco mais de tempo para lerem a mensagem de sucesso (2.5s)
    setTimeout(() => {
      // Remover paramátros de URL que causam resets indesejados
      if (window.location.search.includes("v=")) {
        window.location.href =
          window.location.origin + window.location.pathname;
      } else {
        window.location.reload();
      }
    }, 2500);
  };

  const handleCloseUpdate = () => {
    localStorage.setItem("last_seen_app_version", APP_VERSION);
    setShowUpdateModal(false);
  };

  useEffect(() => {
    // Expose global trigger for deep components
    (window as any).triggerVerification = handleGlobalVerify;
    (window as any).triggerAdminForceView = handleAdminForceView;
    (window as any).triggerTab = (tab: any) => setActiveTab(tab);
    (window as any).triggerWelcomeModal = () => setShowWelcomeModal(true);
  }, []);

  useEffect(() => {
    // Determine initial theme
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    const applyCurrentThemeSetting = () => {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        applyTheme(true);
      } else if (savedTheme === "light") {
        applyTheme(false);
      } else {
        applyTheme(false); // Default to light mode as requested
      }
    };

    // Initial load
    applyCurrentThemeSetting();

    // Listener for system changes
    const themeListener = () => {
      if (!localStorage.getItem("theme")) {
        applyTheme(false); // Default to light mode as requested
      }
    };

    systemPrefersDark.addEventListener("change", themeListener);

    // Custom event for immediate theme toggle without reload
    const onThemeChange = () => applyCurrentThemeSetting();
    window.addEventListener("themeChange", onThemeChange);

    // Liberações Iniciais (Firebase login anonimo necessário para acessar dados base)
    const initFirebase = async (retries = 3) => {
      const success = await loginAnon();
      if (!success && retries > 0) {
        console.warn(
          `Firebase login failed. Retrying in 3s... (${retries} left)`,
        );
        setTimeout(() => initFirebase(retries - 1), 3000);
        return;
      }

      // Silently test connection to warm up the SDK
      const connected = await testConnection();
      (window as any).db_connected = connected;

      if (!connected && retries > 0) {
        console.warn(
          `Firestore server test failed. Retrying in 5s... (${retries} left)`,
        );
        setTimeout(() => initFirebase(retries - 1), 5000);
      }
    };
    initFirebase();

    return () => systemPrefersDark.removeEventListener("change", themeListener);
  }, []);

  return (
    <div className="min-h-screen relative flex flex-col items-center p-0 sm:p-4 print:block print:p-0">
      <AnimatePresence>
        {isUpdating && (
          <motion.div 
            key="updating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-6 p-6"
          >
            <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
            <div className="text-center max-w-sm w-full space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Atualizando Sistema</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Baixando nova versão ({targetVersionText})...
                </p>
              </div>
              
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner">
                <motion.div 
                  className="bg-sky-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${updateProgress}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
              <p className="text-xs font-mono text-slate-400">
                {updateProgress}% concluído
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <DynamicPWA />
      <NotificationObserver />
      <div className="my-auto w-full max-w-3xl glass-panel rounded-none sm:rounded-3xl p-3 sm:p-5 md:p-10 animated-fade-in relative overflow-hidden print:max-w-none print:p-0 print:shadow-none print:bg-white print:dark:bg-white min-h-[100dvh] sm:min-h-0 print:min-h-0 print:border-none print:block">
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-sky-300 dark:bg-sky-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-300 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />

        <AnimatePresence>
            <Suspense fallback={null} key="welcome-suspense">
              <WelcomeModal 
                isOpen={showWelcomeModal && !isUpdating && !showUpdateModal}
                onClose={() => {
                  localStorage.setItem("has_seen_welcome", "true");
                  setShowWelcomeModal(false);
                }} 
              />
            </Suspense>
          {!isUpdating && showUpdateModal && (
            <motion.div
              key="update-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print"
            >
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-5 border border-sky-100 dark:border-sky-500/20 text-center relative max-h-[85vh] overflow-y-auto">
                <div className="absolute top-0 right-0 p-3">
                  <button
                    onClick={handleCloseUpdate}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-500/20 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-3 animate-pulse">
                  <Sparkles className="w-6 h-6" />
                </div>

                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                  {updateStatus === "success"
                    ? "Perfeito!"
                    : "Novidades Chegaram!"}
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest font-black">
                  Versão {APP_VERSION}
                </p>

                {updateStatus === "success" ? (
                  <div className="py-6 animate-bounce">
                    <p className="text-sky-600 dark:text-sky-400 font-bold text-sm">
                      Atualizações aplicadas com sucesso!
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Reiniciando o sistema...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-left space-y-1.5 mb-5">
                      {CHANGELOG.slice(0, 5).map((item, i) => (
                        <div key={i} className="flex gap-2 items-start group">
                          <div className="w-1 h-1 rounded-full bg-sky-500 mt-1.5 shrink-0 group-hover:scale-150 transition-transform" />
                          <span className="text-[10px] leading-tight text-slate-600 dark:text-slate-300 font-medium">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleUpdateClick}
                      className="w-full py-2.5 bg-sky-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 hover:bg-sky-500 transition-all active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar Agora
                    </button>
                  </>
                )}

                <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-tighter">
                  O sistema foi modificado para melhor atendê-lo.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 space-y-6 sm:space-y-8 print:space-y-4">
          <Header onOpenAdmin={() => setActiveTab("admin")} />

          {settings.headerLogoEnabled && settings.headerLogoUrl && (
            <div className="flex flex-col items-center justify-center gap-4 mb-4 mt-2 sm:mt-0 no-print print:hidden">
              <a 
                href={settings.liveBadgeEnabled && settings.liveBadgeUrl ? settings.liveBadgeUrl : (settings.headerLogoLink || "#")} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="relative block max-w-[200px] hover:opacity-90 transition-opacity"
              >
                {settings.liveBadgeEnabled && (
                  <div className="absolute -top-3 -right-6 sm:-right-8 z-10 flex items-center gap-1.5 bg-red-600 outline outline-2 outline-white dark:outline-slate-900 text-white px-2 py-0.5 rounded-full shadow-lg shadow-red-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Ao Vivo</span>
                  </div>
                )}
                <img src={settings.headerLogoUrl} alt="Logo" className="w-full h-auto object-contain drop-shadow-sm" />
              </a>

              {(settings.socialFacebookEnabled || settings.socialInstagramEnabled || settings.socialYoutubeEnabled || settings.socialWhatsappEnabled || settings.socialEmailEnabled) && (
                <div className="flex flex-row items-center justify-center gap-3">
                  {settings.socialFacebookEnabled && (
                    <a href={settings.socialFacebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white dark:bg-slate-800 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors" aria-label="Facebook">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialInstagramEnabled && (
                    <a href={settings.socialInstagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white dark:bg-slate-800 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors" aria-label="Instagram">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialYoutubeEnabled && (
                    <a href={settings.socialYoutubeUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white dark:bg-slate-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors" aria-label="YouTube">
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialWhatsappEnabled && (
                    <a href={settings.socialWhatsappUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white dark:bg-slate-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors" aria-label="WhatsApp">
                      <MessageCircle className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialEmailEnabled && (
                    <a href={settings.socialEmailUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/20 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors" aria-label="Email">
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          
                    {settings.fajopaPlusEnabled && (
            <div className="flex justify-center mb-6 mt-2 no-print print:hidden">
              <a 
                href={settings.fajopaPlusUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative group flex items-center justify-center py-4 w-full max-w-sm rounded-2xl bg-white dark:bg-[#020617] text-slate-900 dark:text-white font-black uppercase tracking-widest overflow-hidden transition-all duration-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(56,189,248,0.15)] hover:shadow-[0_0_30px_rgba(56,189,248,0.3)] border border-slate-200 dark:border-slate-800"
              >
                {/* Animated Gradient Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                
                {/* Glitch/Neon Text Container */}
                <div className="relative z-10 flex items-center gap-2 drop-shadow-md text-xl sm:text-2xl">
                  <span className="text-slate-900 dark:text-white drop-shadow-md glitch-text-hover-only">FAJOPA</span>
                  <span className="text-[#3b82f6] drop-shadow-md">PLUS</span>
                </div>
              </a>
            </div>
          )}
          {(settings.sophiaEnabled || settings.libraryEnabled || settings.avaEnabled || settings.contemplacaoEnabled) && (
            <div className={`grid gap-2 no-print print:hidden mb-4 sm:-mt-2 ${
              [settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 4 
                 ? "grid-cols-2 lg:grid-cols-4" 
                 : [settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 3
                ? "grid-cols-3"
                : [settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 2
                ? "grid-cols-2"
                : "grid-cols-1"
            }`}>
                            
              {settings.sophiaEnabled && (
                <a 
                  href={settings.sophiaLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 text-sky-600 dark:text-sky-400 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group"
                >
                  <User className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">Portal do Aluno</span>
                </a>
              )}
              {settings.libraryEnabled && (
                <a 
                  href={settings.libraryLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 text-sky-600 dark:text-sky-400 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group"
                >
                  <BookHeart className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">Biblioteca Virtual</span>
                </a>
              )}
              {settings.avaEnabled && (
                <a 
                  href={settings.avaLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 text-sky-600 dark:text-sky-400 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group"
                >
                  <MonitorPlay className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">Ambiente Virtual</span>
                </a>
              )}
              {settings.contemplacaoEnabled && (
                <a 
                  href={settings.contemplacaoLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 text-sky-600 dark:text-sky-400 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group"
                >
                  <BookOpen className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">Revista Contemplação</span>
                </a>
              )}
            </div>
          )}

            <div 
              className="grid bg-slate-200/50 dark:bg-slate-900/60 rounded-xl p-1 shadow-inner border border-slate-200/50 dark:border-slate-700/50 no-print print:hidden gap-1"
              style={{ gridTemplateColumns: `repeat(${3 + (settings.eventsEnabled !== false ? 1 : 0) + (settings.muralEnabled !== false ? 1 : 0) + (settings.appointmentsEnabled !== false ? 1 : 0)}, minmax(0, 1fr))` }}
            >
              <button
                onClick={() => setActiveTab("student")}
                className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === "student" ? "bg-white dark:bg-amber-500 text-amber-600 dark:text-amber-50 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                <User className="w-4 h-4 mb-0.5" />
                Minha ID
              </button>
              <button
                onClick={() => setActiveTab("verifier")}
                className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === "verifier" ? "bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                <Shield className="w-4 h-4 mb-0.5" />
                Verificar
              </button>
              {settings.eventsEnabled !== false && (
                <button
                  onClick={() => setActiveTab("events")}
                  className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === "events" ? "bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                >
                  <Calendar className="w-4 h-4 mb-0.5" />
                  Eventos
                </button>
              )}
              {settings.appointmentsEnabled !== false && (
                <button
                  onClick={() => setActiveTab("appointments")}
                  className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === "appointments" ? "bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                >
                  <HeartHandshake className="w-4 h-4 mb-0.5" />
                  Seminário
                </button>
              )}
              <button
                onClick={() => setActiveTab("liturgy")}
                className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === "liturgy" ? "bg-white dark:bg-rose-600 text-rose-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                <BookHeart className="w-4 h-4 mb-0.5" />
                Portal Católico
              </button>
              {settings.muralEnabled !== false && (
                <button
                  onClick={() => setActiveTab("mural")}
                  className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${activeTab === "mural" ? "bg-white dark:bg-amber-600 text-amber-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                >
                  <Sparkles className="w-4 h-4 mb-0.5" />
                  Mural
                </button>
              )}
            </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{
                opacity: 0,
                x:
                  activeTab === "student"
                    ? -20
                    : activeTab === "admin"
                      ? 20
                      : 0,
              }}
              animate={{ opacity: 1, x: 0 }}
              exit={{
                opacity: 0,
                x:
                  activeTab === "student"
                    ? 20
                    : activeTab === "admin"
                      ? -20
                      : 0,
              }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="flex justify-center p-10">
                      <Loader2 className="animate-spin text-sky-500 w-8 h-8" />
                    </div>
                  }
                >
                  {activeTab === "verifier" && (
                    <Verifier
                      externalCode={targetVerifyCode}
                      onExternalVerified={() => setTargetVerifyCode(null)}
                    />
                  )}
                  {activeTab === "admin" && <Admin />}
                  {activeTab === "events" && <EventsPage onNavigateToStudent={() => setActiveTab("student")} />}
                  {activeTab === "appointments" && <PublicAppointmentsList member={null} onNavigateToStudent={() => setActiveTab("student")} />}
                  {activeTab === "liturgy" && <LiturgyPanel />}
                  {activeTab === "mural" && <MuralPage />}
                  {activeTab === "student" && (
                    <StudentPortal
                      overrideCode={adminForceViewCode}
                      onOverrideConsumed={() => setAdminForceViewCode(null)}
                    />
                  )}
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>

          <Footer />
        </div>
      </div>
    </div>
  );
}
