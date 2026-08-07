import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Download, Sun, Moon, Bell, Trash2, Lock, Share2, Copy, Volume2, VolumeX, Volume1, RefreshCw, Vibrate, VibrateOff } from 'lucide-react';
import { APP_VERSION, APP_BUILD } from '../lib/constants';
import { useSettings } from '../context/SettingsContext';
import { useDialog } from '../context/DialogContext';
import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { markAllNotificationsAsRead, markNotificationAsRead, clearAllNotifications, clearNotification } from '../lib/firebase';
import { getSoundVolume, setSoundVolume, playSound } from '../lib/sounds';
import { getHapticsEnabled, setHapticsEnabled, triggerHaptic } from '../lib/haptics';
import ChangelogModal from './ChangelogModal';

const STUDENT_BOND_KEY = 'davveroId_student_identity';
const STUDENT_TRACK_KEY = 'davveroId_student_track_ra';

export default function Header({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const { settings } = useSettings();
  const { showConfirm, showAlert } = useDialog();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showVolumeDropdown, setShowVolumeDropdown] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(() => getSoundVolume());
  const [haptics, setHaptics] = useState(() => getHapticsEnabled());
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const volumeDropdownRef = useRef<HTMLDivElement>(null);

  const handleVolumeChange = (e: any) => {
    const newVol = parseFloat(e.target.value);
    setCurrentVolume(newVol);
    setSoundVolume(newVol);
  };

  const toggleHaptics = () => {
    const newVal = !haptics;
    setHaptics(newVal);
    setHapticsEnabled(newVal);
    if (newVal) triggerHaptic('success');
  };

  const isMasterLogged = localStorage.getItem('adminMasterLogged') === 'true';
  const bondedId = localStorage.getItem(STUDENT_BOND_KEY) || localStorage.getItem(STUDENT_TRACK_KEY);
  const recipientId = isMasterLogged ? "admin" : bondedId ? bondedId : null;
  const { notifications, unreadCount } = useNotifications(recipientId);
  const [notiPermission, setNotiPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotiPermission(Notification.permission);
    }
    if (typeof navigator !== 'undefined') {
      setIsMobileDevice(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotiPermission(perm);
    }
  };

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    
    // Check initial theme
    const checkTheme = () => {
      const domDark = document.documentElement.classList.contains('dark');
      const storageDark = localStorage.getItem('theme') === 'dark';
      setIsDark(domDark || storageDark);
    };
    checkTheme();
    window.addEventListener('themeChange', checkTheme);
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (volumeDropdownRef.current && !volumeDropdownRef.current.contains(e.target as Node)) {
        setShowVolumeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('themeChange', checkTheme);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    const newTheme = isCurrentlyDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    
    // Explicitly toggle DOM
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    window.dispatchEvent(new Event('themeChange'));
    setIsDark(newTheme === 'dark');
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } catch (err) {
      console.error('Failed to prompt install:', err);
      setDeferredPrompt(null);
    }
  };

  const { 
    instLogo, 
    instName, 
    instColor, 
    instDescription 
  } = settings;

  // Versão SVG robusta...

  const ScannerLogo = () => (
    <div className="relative flex flex-col items-center justify-center w-32 h-32 sm:w-40 sm:h-40 bg-slate-50 dark:bg-slate-800/80 rounded-3xl shadow-[inset_0_4px_20px_rgba(0,0,0,0.05)] border-[1.5px] border-slate-200 dark:border-slate-700 overflow-hidden">
       {/* Shield background subtle glow */}
       <div 
         className="absolute inset-0 opacity-10"
         style={{ backgroundColor: instColor }}
       ></div>
       
       {instLogo ? (
         <img 
           src={instLogo} 
           alt="Logo" 
           className="w-[75%] h-[75%] object-contain z-10" 
           style={{ filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
         />
       ) : (
         <svg 
           viewBox="0 0 100 100" 
           className="w-[65%] h-[65%] z-10" 
           style={{ 
             color: instColor,
             filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)'
           }}
         >
            {/* Shield Outline */}
            <path d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinejoin="round" />
            
            {/* Mortarboard / Academic Cap */}
            <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
            <path d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z" fill="currentColor" opacity="0.85" />
            
            {/* Tassel */}
            <path d="M50,45 L78,55 L78,70" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="78" cy="72" r="2.5" fill="currentColor"/>
         </svg>
       )}
       
       {/* Scanning line animation */}
       <motion.div 
         className="absolute top-0 left-0 w-full h-[3px] blur-[0.5px] opacity-80 z-20"
         style={{ 
           backgroundColor: instColor,
           boxShadow: `0 0 12px 2px ${instColor}b3`
         }}
         animate={{ y: [-10, 170, -10] }}
         transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
       />
       <motion.div 
         className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-transparent z-0"
         style={{ backgroundColor: `${instColor}1a` }}
         animate={{ y: [-100, 160, -100] }}
         transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
       />

      <div className="absolute bottom-2 font-black text-[9px] tracking-[0.15em] text-blue-900 dark:text-sky-100 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md px-2.5 py-0.5 rounded shadow-sm border border-white/40 dark:border-slate-600/50 z-30">
        DAVVERO System
      </div>
    </div>
  );

  return (
    <div className="text-center relative print:hidden no-print pt-14">
      <div className="absolute top-0 left-0 flex items-center gap-2 z-50 no-print print:hidden">
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="relative p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors hover:scale-110 active:scale-95"
            title="Gestão"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}
        <button 
          onClick={toggleTheme}
          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors no-print hover:scale-110 active:scale-95"
          title={isDark ? "Mudar para Claro" : "Mudar para Escuro"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button 
          onClick={() => setShowChangelog(true)}
          className="flex items-center justify-center px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap hover:text-sky-500 dark:hover:text-sky-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Ver Novidades da Versão"
        >
          v{APP_VERSION} <span className="opacity-50 ml-1">({APP_BUILD})</span>
        </button>
      </div>
      <div className="absolute top-0 right-0 flex items-center gap-2 z-50 no-print print:hidden">
        <button 
          onClick={async () => {
             if ('serviceWorker' in navigator) {
               const regs = await navigator.serviceWorker.getRegistrations();
               for (let reg of regs) { await reg.unregister(); }
             }
             window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
          }}
          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors no-print hover:scale-110 active:scale-95"
          title="Forçar Atualização"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <div className="relative" ref={volumeDropdownRef}>
          <button
            onClick={() => setShowVolumeDropdown(!showVolumeDropdown)}
            className="relative p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors no-print hover:scale-110 active:scale-95"
            title="Configurações de Som"
          >
            {currentVolume === 0 ? <VolumeX className="w-4 h-4 text-rose-500" /> : currentVolume < 0.1 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showVolumeDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 text-left"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {currentVolume === 0 ? (
                      <VolumeX 
                        className="w-4 h-4 text-rose-500 hover:opacity-75 cursor-pointer" 
                        onClick={() => handleVolumeChange({ target: { value: '0.05' } } as any)}
                      />
                    ) : (
                      <Volume2 
                        className="w-4 h-4 text-sky-500 hover:opacity-75 cursor-pointer" 
                        onClick={() => handleVolumeChange({ target: { value: '0' } } as any)}
                      />
                    )}
                    <input 
                      type="range" 
                      min="0" 
                      max="0.5" 
                      step="0.01" 
                      value={currentVolume}
                      onChange={(e) => {
                        handleVolumeChange(e);
                        if (parseFloat(e.target.value) > 0) playSound('click');
                      }}
                      className="w-full accent-sky-500 outline-none h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                  {isMobileDevice && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center gap-2">
                        {haptics ? (
                          <Vibrate className="w-4 h-4 text-sky-500" />
                        ) : (
                          <VibrateOff className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Vibração
                        </span>
                      </div>
                      <button
                        onClick={toggleHaptics}
                        className={`w-8 h-4 rounded-full transition-colors relative ${haptics ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${haptics ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {recipientId && (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors no-print hover:scale-110 active:scale-95"
              title="Notificações"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-pink-500 rounded-full animate-pulse border border-white dark:border-slate-800"></span>
              )}
            </button>
            <AnimatePresence>
              {showDropdown && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 text-left"
                >
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-widest">Notificações</h3>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button 
                          onClick={() => {
                             if (recipientId) {
                               // Mark specific broadcasts locally
                               notifications.filter(n => n.recipientId === "todos" && !n.read).forEach(n => {
                                 markNotificationAsRead(n.id, true);
                               });
                               markAllNotificationsAsRead(recipientId);
                             }
                          }}
                          className="text-[10px] text-sky-600 dark:text-sky-400 font-bold hover:underline uppercase"
                        >
                          Marcar Lidas
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                             if (recipientId) {
                               clearAllNotifications(recipientId);
                             }
                          }}
                          className="text-[10px] text-red-500 dark:text-red-400 font-bold hover:underline uppercase"
                        >
                          Limpar Todas
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto w-full flex flex-col p-2 space-y-1">
                    {notiPermission === 'default' && (
                      <button 
                        onClick={requestNotificationPermission}
                        className="w-full mb-2 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl p-3 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Bell className="w-3 h-3" />
                        Ativar Alertas no Sistema
                      </button>
                    )}
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        Nenhuma notificação nova.
                      </div>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <div key={n.id} className="relative group">
                          <button
                            onClick={() => {
                              if (!n.read) markNotificationAsRead(n.id, n.recipientId === "todos");
                              
                              // Navegação via triggerTab global
                              const trigger = (window as any).triggerTab;
                              if (trigger) {
                                if (n.type === 'evento') trigger('events');
                                else if (n.type === 'carteirinha') trigger('student');
                                else if (n.type === 'edicao') {
                                  if (isMasterLogged) trigger('admin');
                                  else trigger('student');
                                }
                                else if (n.type === 'certificado') trigger('student');
                                else if (n.type === 'inscricao' || n.type === 'appointment_swap') trigger('admin');
                              }
                              setShowDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-start gap-2.5 ${n.read ? 'opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800' : 'bg-sky-50 dark:bg-sky-900/10 hover:bg-sky-100 dark:hover:bg-sky-900/20'}`}
                          >
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-pink-500'}`} />
                            <div className="flex-1 min-w-0 pr-6">
                              <p className={`text-xs ${n.read ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>{n.title}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight whitespace-pre-wrap">{n.message}</p>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 uppercase">{(new Date(n.createdAt)).toLocaleString('pt-BR')}</p>
                            </div>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(n.id, n.recipientId === "todos");
                            }}
                            className="absolute top-2.5 right-2.5 p-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition duration-200"
                            title="Remover Notificação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <button 
          onClick={async () => {
            const shareUrl = window.location.origin + '/?install=true';
            if (navigator.share) {
              try {
                await navigator.share({
                  title: instName || 'Aplicativo',
                  text: 'Acesse o link para instalar o nosso aplicativo.',
                  url: shareUrl
                });
              } catch (e) {
                console.error('Erro ao compartilhar', e);
              }
            } else {
              navigator.clipboard.writeText(shareUrl);
              showAlert("Link de instalação copiado para a área de transferência!", { type: "success" });
            }
          }}
          className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors no-print hover:scale-110 active:scale-95"
          title="Compartilhar Aplicativo"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex justify-center mb-6 no-print min-h-[140px] items-center relative">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            y: [0, -10, 0],
          }}
          transition={{
            y: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            },
            scale: { duration: 0.8 },
            opacity: { duration: 0.8 }
          }}
          whileHover={{ scale: 1.05 }}
          className="relative z-10"
        >
          {/* Brilho de Fundo Pulsante */}
          <div className="absolute inset-x-0 -inset-y-8 bg-sky-400/20 dark:bg-sky-400/30 blur-3xl rounded-full scale-125 animate-pulse-slow pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-center">
            <ScannerLogo />
          </div>
        </motion.div>
      </div>
      <h1 
        className="text-3xl sm:text-4xl md:text-5xl font-extrabold animated-slide-in-up tracking-tight mb-1 print:text-2xl flex justify-center items-baseline gap-1.5 sm:gap-2"
      >
        <span 
          className="text-transparent bg-clip-text"
          style={{ 
            backgroundImage: `linear-gradient(to right, ${instColor}, #14b8a6, #10b981)`,
          }}
        >
          DAVVERO
        </span>
        <span className="text-xl sm:text-2xl md:text-3xl font-medium tracking-normal text-slate-400 dark:text-slate-500">
          System
        </span>
      </h1>
      <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] sm:text-xs tracking-[0.2em] animated-fade-in uppercase">
        {instDescription}
      </p>

      <div className="flex flex-col items-center mt-4 gap-1.5 uppercase font-black tracking-widest text-[8px] sm:text-[9px] animated-fade-in">
        {deferredPrompt && (
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-2 bg-sky-500 text-white px-4 py-2 rounded-full shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition-all scale-110 mb-2 animate-bounce"
          >
            <Download className="w-3 h-3" />
            INSTALAR DAVVERO System
          </button>
        )}
        <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
          MODO: NUVEM (ONLINE)
        </div>
        <div className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 bg-slate-400/5 px-3 py-1 rounded-full border border-slate-400/10">
          BANCO DE DADOS: {settings.databaseName || instName}
        </div>
      </div>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}

