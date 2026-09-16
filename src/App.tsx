import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useDialog } from "./context/DialogContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import {
  Shield,
  User,
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
  HeartHandshake,
  CheckCircle2,
  Landmark,
  GraduationCap,
  WifiOff,
  Info,
  ExternalLink
} from "lucide-react";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { loginAnon, testConnection, subscribeToQuotaStatus, isFirestoreQuotaExhausted } from "./lib/firebase";
import { recordAppAccess, startPresenceHeartbeat } from "./lib/telemetry";
import { motion, AnimatePresence } from "motion/react";
import ErrorBoundary from "./components/ErrorBoundary";
import DynamicPWA from "./components/DynamicPWA";
import NotificationObserver from "./components/NotificationObserver";
import VersionUpdateGate from "./components/VersionUpdateGate";
import OfflineNotice from "./components/OfflineNotice";
import { useSettings } from "./context/SettingsContext";
import { APP_VERSION, CHANGELOG } from "./lib/constants";
import { playSound } from "./lib/sounds";
import { checkServerVersionWithAntiLoop, safeReloadApp, clearAppCaches, isVersionOutdated } from "./lib/versionManager";
import { triggerSWCheck } from "./pwa";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import Verifier from "./components/Verifier";
import YouTubeLiveButton from "./components/YouTubeLiveButton";
import HomePollsWidget from "./components/HomePollsWidget";
import { useYouTubeLive } from "./hooks/useYouTubeLive";
import WelcomeModal from "./components/WelcomeModal";

import StudentPortal from "./components/StudentPortal";

/**
 * Força o cache de todos os recursos necessários para a StudentPortal
 * durante o primeiro carregamento com sucesso utilizando a API de Cache.
 * Garante que a carteirinha e todos os seus recursos visuais funcionem instantaneamente offline.
 */
export async function forceCacheStudentPortalResources(appSettings?: any): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }
  // Só executa quando a conexão estiver ativa
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  try {
    const [shellCache, staticCache, imagesCache] = await Promise.all([
      caches.open("app-shell-cache"),
      caches.open("static-assets-cache"),
      caches.open("images-cache"),
    ]);

    // 1. App Shell e arquivos fundamentais da aplicação
    const shellUrls = [
      "/",
      "/index.html",
      "/manifest.json",
      "/version.json",
    ];

    // 2. Ícones institucionais, PWA e recursos gráficos
    const iconUrls = [
      "/icon.svg",
      "/icon.png",
      "/icon-192.png",
      "/icon-512.png",
      "/icon-maskable.svg",
      "/icon-maskable-192.png",
      "/icon-maskable-512.png",
      "/apple-touch-icon.png",
      "/apple-touch-icon-180x180.png",
      "/apple-touch-icon-152x152.png",
      "/apple-touch-icon-167x167.png",
      "/apple-touch-icon-precomposed.png",
      "/favicon.ico",
      "/favicon-32x32.png",
      "/favicon-16x16.png",
      "/logo.png",
      "/logo192.png",
      "/logo512.png",
    ];

    // 3. Captura dinâmica de scripts e estilos carregados no DOM
    const activeScripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>("script[src]")
    )
      .map((s) => s.src)
      .filter((src) => src && !src.includes("firebase-messaging") && !src.includes("chrome-extension"));

    const activeStylesheets = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"], link[rel="modulepreload"]'
      )
    )
      .map((l) => l.href)
      .filter((href) => href && !href.includes("chrome-extension"));

    // 4. Recursos da Carteirinha Estudantil vinculada / salva localmente
    const studentCardMediaUrls: string[] = [];
    try {
      const cachedMemberRaw =
        localStorage.getItem("davveroId_cached_member") ||
        localStorage.getItem("davvero_cached_member");
      if (cachedMemberRaw) {
        const cachedMember = JSON.parse(cachedMemberRaw);
        if (
          cachedMember?.photoUrl &&
          typeof cachedMember.photoUrl === "string" &&
          (cachedMember.photoUrl.startsWith("http://") ||
            cachedMember.photoUrl.startsWith("https://"))
        ) {
          studentCardMediaUrls.push(cachedMember.photoUrl);
        }
      }
    } catch {}

    // Imagens e assinaturas institucionais das configurações da carteirinha
    if (appSettings) {
      const configImages = [
        appSettings.instLogo,
        appSettings.cardLogo,
        appSettings.cardBackLogo,
        appSettings.cardSecondaryBackLogo,
        appSettings.cardBackImage,
        appSettings.instSignature,
        appSettings.rectorSignature,
      ].filter(
        (url): url is string =>
          typeof url === "string" &&
          (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"))
      );
      studentCardMediaUrls.push(...configImages);
    }

    // Gravação segura no Cache API
    const cacheUrlSafely = async (cache: Cache, url: string, isImage = false) => {
      try {
        const existing = await cache.match(url);
        if (existing && (existing.ok || existing.type === "opaque")) {
          return;
        }

        const isSameOrigin = url.startsWith(window.location.origin) || url.startsWith("/");
        const fetchOptions: RequestInit = isImage
          ? { mode: isSameOrigin ? "cors" : "no-cors" }
          : { cache: "no-cache" };

        const response = await fetch(url, fetchOptions);
        if (response && (response.ok || response.type === "opaque")) {
          await cache.put(url, response.clone());
        }
      } catch {
        // Ignora erros pontuais de URLs externas ou CORS sem interromper as demais
      }
    };

    await Promise.allSettled([
      ...shellUrls.map((u) => cacheUrlSafely(shellCache, u)),
      ...activeScripts.map((u) => cacheUrlSafely(staticCache, u)),
      ...activeStylesheets.map((u) => cacheUrlSafely(staticCache, u)),
      ...iconUrls.map((u) => cacheUrlSafely(imagesCache, u, true)),
      ...studentCardMediaUrls.map((u) => cacheUrlSafely(imagesCache, u, true)),
    ]);

    try {
      sessionStorage.setItem("davvero_student_portal_precached", "true");
    } catch {}

    console.log("[App] Recursos vitais da Carteirinha (StudentPortal) armazenados em Cache API com sucesso.");
  } catch (err) {
    console.warn("[App] Aviso ao forçar cache dos recursos da StudentPortal:", err);
  }
}
const Admin = lazyWithRetry(() => import("./components/Admin"));
const EventsPage = lazyWithRetry(() => import("./components/EventsPage"));
const PublicAppointmentsList = lazyWithRetry(() => import("./components/PublicAppointmentsList"));
const DioceseHub = lazyWithRetry(() => import("./components/DioceseHub"));
const CoursesOffers = lazyWithRetry(() => import("./components/CoursesOffers"));

export default function App() {
  const { settings } = useSettings();
  const { showAlert } = useDialog();
  const { isOnline } = useOnlineStatus();
  const [showOfflineInfoModal, setShowOfflineInfoModal] = useState(false);
  const youtubeLive = useYouTubeLive();
  const isFacultyLive = youtubeLive.isLive || Boolean(settings.liveBadgeEnabled);
  const liveTargetUrl = youtubeLive.videoId
    ? `https://www.youtube.com/watch?v=${youtubeLive.videoId}`
    : (youtubeLive.liveUrl || settings.liveBadgeUrl || "https://www.youtube.com/@fajopademarilia/live");
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const isDirectDeepLink =
        params.has("event") || 
        params.has("checkin_event") ||
        params.has("checkin") ||
        params.has("cert") || 
        params.has("verify") || 
        params.has("diocese") || 
        params.get("tab") === "diocese" ||
        params.get("tab") === "certificates" ||
        params.get("tab") === "certificados" ||
        params.get("view") === "certificates" ||
        params.get("view") === "student" ||
        params.has("certEvent") ||
        params.has("eventId") ||
        params.has("certType") ||
        params.has("unsubscribeEmail") ||
        params.has("unsubscribe");

      if (isDirectDeepLink) {
        try {
          localStorage.setItem("has_seen_welcome", "true");
        } catch {}
        return false;
      }
    }
    return localStorage.getItem("has_seen_welcome") !== "true";
  });
  const [activeTab, setActiveTab] = useState<
    "verifier" | "admin" | "student" | "events" | "diocese" | "appointments" | "courses"
  >(() => {
    // Only access window parameters on component mount
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") || params.get("view");

      if (
        tabParam === "student" ||
        tabParam === "aluno" ||
        tabParam === "carteirinha" ||
        tabParam === "certificates" ||
        tabParam === "certificados" ||
        params.has("certEvent") ||
        params.has("eventId") ||
        params.has("certType") ||
        params.has("unsubscribeEmail") ||
        params.has("unsubscribe")
      ) {
        return "student";
      }
      if (tabParam === "events" || tabParam === "eventos" || params.has("event") || params.has("checkin_event") || params.has("checkin")) {
        return "events";
      }
      if (
        tabParam === "courses" ||
        tabParam === "cursos" ||
        tabParam === "ofertas" ||
        tabParam === "cursos-e-ofertas" ||
        params.has("courses") ||
        params.has("cursos")
      ) {
        return "courses";
      }
      if (params.has("cert") || params.has("verify") || tabParam === "verifier") {
        return "verifier";
      }
      if (tabParam === "diocese" || params.has("diocese")) {
        return "diocese";
      }
      if (tabParam === "appointments" || tabParam === "agendamentos") {
        return "appointments";
      }
      if (tabParam === "admin") {
        return "admin";
      }

      // Modo offline: inicia diretamente e exclusivamente na Carteirinha (student)
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return "student";
      }

      // Restauração inteligente: se há uma carteirinha vinculada no aparelho ou última aba salva
      try {
        const hasBondedIdentity = !!(
          localStorage.getItem("davveroId_student_identity") ||
          localStorage.getItem("davveroId_cached_member") ||
          localStorage.getItem("davvero_cached_member")
        );
        const savedTab = localStorage.getItem("davvero_last_active_tab");
        if (savedTab && ["student", "verifier", "events", "diocese", "appointments", "courses"].includes(savedTab)) {
          return savedTab as any;
        }
        if (hasBondedIdentity) {
          return "student";
        }
      } catch {}
    }
    return "verifier";
  });

  const prefetchedTabsRef = useRef<Set<string>>(new Set());
  const hoverPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPrefetch = useCallback(() => {
    if (hoverPrefetchTimerRef.current) {
      clearTimeout(hoverPrefetchTimerRef.current);
      hoverPrefetchTimerRef.current = null;
    }
  }, []);

  const switchTab = useCallback((tab: "verifier" | "admin" | "student" | "events" | "diocese" | "appointments" | "courses") => {
    cancelPrefetch();
    if (!isOnline && tab !== "student") {
      setShowOfflineInfoModal(true);
      return;
    }
    setActiveTab(tab);
    playSound('pop');
    try {
      if (tab !== "admin") {
        localStorage.setItem("davvero_last_active_tab", tab);
      }
    } catch {}
  }, [cancelPrefetch, isOnline]);

  // Se a conexão for interrompida, redireciona suavemente para a Carteirinha
  useEffect(() => {
    if (!isOnline && activeTab !== "student") {
      setActiveTab("student");
    }
  }, [isOnline, activeTab]);

  const handleStudentNavigate = useCallback(() => switchTab("student"), [switchTab]);
  const handleEventsNavigate = useCallback(() => switchTab("events"), [switchTab]);
  const handleDioceseNavigate = useCallback(() => switchTab("diocese"), [switchTab]);
  const handleOverrideConsumed = useCallback(() => setAdminForceViewCode(null), []);
  const handleExternalVerified = useCallback(() => setTargetVerifyCode(null), []);

  // Pré-carregamento sob demanda com atraso mínimo de repouso (hover delay)
  // Reduz consumo desnecessário de rede e memória durante varreduras rápidas de cursor
  const prefetchTab = useCallback((
    tab: "student" | "courses" | "events" | "appointments" | "diocese" | "admin",
    minHoverDelay = 300
  ) => {
    cancelPrefetch();

    // Se estiver offline ou com modo de economia de dados ativado, não faz prefetch preventivo
    if (typeof navigator !== "undefined") {
      if (navigator.onLine === false || (navigator as any).connection?.saveData) {
        return;
      }
    }

    // Evita consumo redundante caso a aba já esteja aberta ou já tenha sido baixada
    if (activeTab === tab || prefetchedTabsRef.current.has(tab)) {
      return;
    }

    const loadComponent = () => {
      // Garante que a requisição só é enviada se a rede estiver disponível
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (prefetchedTabsRef.current.has(tab)) return;
      prefetchedTabsRef.current.add(tab);
      try {
        if (tab === "student") import("./components/StudentPortal");
        else if (tab === "courses") import("./components/CoursesOffers");
        else if (tab === "events") import("./components/EventsPage");
        else if (tab === "diocese") import("./components/DioceseHub");
        else if (tab === "appointments") import("./components/PublicAppointmentsList");
        else if (tab === "admin") import("./components/Admin");
      } catch {
        prefetchedTabsRef.current.delete(tab);
      }
    };

    if (minHoverDelay > 0) {
      hoverPrefetchTimerRef.current = setTimeout(loadComponent, minHoverDelay);
    } else {
      loadComponent();
    }
  }, [activeTab, cancelPrefetch]);

  // Limpeza de timers de pré-carregamento ao desmontar ou trocar de aba
  useEffect(() => {
    return () => {
      if (hoverPrefetchTimerRef.current) {
        clearTimeout(hoverPrefetchTimerRef.current);
        hoverPrefetchTimerRef.current = null;
      }
    };
  }, [activeTab]);
  const [targetVerifyCode, setTargetVerifyCode] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("cert")) {
        return params.get("cert");
      }
      if (params.has("verify")) {
        return params.get("verify");
      }
    }
    return null;
  });

  useEffect(() => {
    if (targetVerifyCode) {
      setActiveTab("verifier");
      // Mantém o cabeçalho superior e cadeado visíveis garantindo scroll no topo
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [targetVerifyCode]);
  const [adminForceViewCode, setAdminForceViewCode] = useState<string | null>(
    null,
  );
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "success">("idle");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [targetVersionText, setTargetVersionText] = useState("");
  const [isLoopBlocked, setIsLoopBlocked] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(isFirestoreQuotaExhausted);

  useEffect(() => {
    return subscribeToQuotaStatus(setIsQuotaExhausted);
  }, []);

  // Modal para busca interativa de atualizações
  const [updateCheckModal, setUpdateCheckModal] = useState<{
    isOpen: boolean;
    status: "searching" | "up_to_date" | "outdated" | "error";
    message: string;
    serverVersion?: string;
  }>({
    isOpen: false,
    status: "searching",
    message: "Buscando atualizações no servidor...",
  });

  const handleForceReloadAndSync = async (targetVer?: string) => {
    playSound('pop');
    setUpdateCheckModal(prev => ({ ...prev, isOpen: false }));
    setIsUpdating(true);
    setTargetVersionText(targetVer || APP_VERSION);
    setUpdateProgress(25);
    try {
      sessionStorage.removeItem("davvero_version_reload_count");
      sessionStorage.removeItem("davvero_version_last_attempt_ts");
      sessionStorage.removeItem("davvero_version_target");
    } catch {}
    await clearAppCaches();
    setUpdateProgress(70);
    setTimeout(async () => {
      setUpdateProgress(100);
      await safeReloadApp(targetVer || APP_VERSION);
    }, 300);
  };

  const handleOpenAdmin = () => {
    switchTab("admin");
    // Redireciona na tela para as opções (dashboard, membros, eventos, agendamentos, etc.)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("focus-admin-options"));
      const target = document.getElementById("admin-tabs-nav") || document.getElementById("admin-section");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  };

  const handleInteractiveUpdateCheck = async () => {
    playSound('pop');
    setUpdateCheckModal({
      isOpen: true,
      status: "searching",
      message: "Consultando o servidor e verificando os módulos mais recentes...",
    });

    try {
      // Disparar verificação tanto no service worker quanto na API de versão
      triggerSWCheck().catch(() => {});
      const startTime = Date.now();
      const res = await checkServerVersionWithAntiLoop(true, settings?.version);
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((r) => setTimeout(r, 800 - elapsed));
      }

      if (res.isObsolete) {
        setUpdateCheckModal({
          isOpen: true,
          status: "outdated",
          message: `Nova versão encontrada (v${res.serverVersion})! Sincronizando e atualizando os arquivos...`,
          serverVersion: res.serverVersion,
        });
        playSound('success');
        setTimeout(async () => {
          setUpdateCheckModal(prev => ({ ...prev, isOpen: false }));
          setIsUpdating(true);
          setTargetVersionText(res.serverVersion);
          setUpdateProgress(35);
          await clearAppCaches();
          setUpdateProgress(80);
          setTimeout(async () => {
            setUpdateProgress(100);
            await safeReloadApp(res.serverVersion);
          }, 350);
        }, 1200);
      } else {
        setUpdateCheckModal({
          isOpen: true,
          status: "up_to_date",
          message: `O DAVVERO System já está 100% atualizado na versão mais recente (v${APP_VERSION})!`,
          serverVersion: APP_VERSION,
        });
        playSound('success');
      }
    } catch {
      setUpdateCheckModal({
        isOpen: true,
        status: "up_to_date",
        message: `O DAVVERO System está atualizado na versão v${APP_VERSION}!`,
        serverVersion: APP_VERSION,
      });
      playSound('success');
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest) return;
      if (target.closest('button, a, [role="button"], input[type="checkbox"]')) {
        playSound('pop');
      }
    };
    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Ref para memorizar se o usuário dispensou o portão nesta sessão
  const userDismissedGateRef = useRef(false);

  // Verificação de versão unificada, estável e reativa
  const performSafeVersionCheck = useCallback(async (force = false, knownVer?: string) => {
    if (
      userDismissedGateRef.current ||
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem("davvero_gate_dismissed") === "true")
    ) {
      setIsLoopBlocked(false);
      return;
    }

    const candidate = knownVer || settings?.version;
    const res = await checkServerVersionWithAntiLoop(force, candidate);
    if (res.isObsolete) {
      setTargetVersionText(res.serverVersion);
      if (res.isLoopBlocked) {
        // Bloqueio de loop acionado: impede auto-reloads infinitos e ativa o portão de bloqueio de versão obsoleta
        setIsLoopBlocked(true);
        setIsUpdating(false);
      } else {
        // Atualização automática limpa de 1 ciclo com sincronização profunda de caches
        setIsLoopBlocked(false);
        setIsUpdating(true);
        setUpdateProgress(25);

        await clearAppCaches();
        setUpdateProgress(75);

        setTimeout(async () => {
          setUpdateProgress(100);
          await safeReloadApp(res.serverVersion);
        }, 450);
      }
    } else {
      setIsLoopBlocked(false);
    }
  }, [settings?.version]);

  // Observa sincronização em tempo real de versão via Firestore (settings.version)
  useEffect(() => {
    if (settings?.version && isVersionOutdated(APP_VERSION, settings.version)) {
      console.log(`[App] Nova versão remota detectada (${settings.version}). Iniciando atualização automática...`);
      performSafeVersionCheck(false, settings.version);
    }
  }, [settings?.version, performSafeVersionCheck]);

  useEffect(() => {
    // 1. Limpeza de query params acumulados (?_upd=, ?v= ou ?t=) para manter a URL limpa e evitar loops
    if (typeof window !== "undefined" && (window.location.search.includes("_upd=") || window.location.search.includes("v=") || window.location.search.includes("t="))) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("_upd");
        url.searchParams.delete("v");
        url.searchParams.delete("t");
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
      } catch {}
    }

    const lastSeenVersion = localStorage.getItem("last_seen_app_version");
    
    // Mostra o modal de novidades se o app já estava instalado e agora é uma versão mais nova
    if (!lastSeenVersion) {
      localStorage.setItem("last_seen_app_version", APP_VERSION);
    } else if (lastSeenVersion !== APP_VERSION) {
      setShowUpdateModal(true);
    }

    localStorage.setItem("app_version", APP_VERSION);

    // Verificação inicial imediata
    performSafeVersionCheck(false, settings?.version);
    triggerSWCheck().catch(() => {});

    // Telemetry and Realtime Presence
    recordAppAccess();
    const stopPresence = startPresenceHeartbeat();

    // Verificação periódica ativa a cada 40 segundos para detectar novas publicações imediatamente (somente se online)
    const versionInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      performSafeVersionCheck(false, settings?.version);
      triggerSWCheck().catch(() => {});
    }, 40 * 1000);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        performSafeVersionCheck(false, settings?.version);
        triggerSWCheck().catch(() => {});
      }
    };

    const onServiceWorkerUpdated = async () => {
      // Se estiver sem internet, NUNCA disparar atualização nem recarga da página, pois isso causa ERR_FAILED no navegador
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        console.log("[App] Atualização de SW detectada, mas rede offline. Atualização cancelada para evitar ERR_FAILED.");
        return;
      }
      console.log("[App] Evento de Service Worker atualizado recebido. Executando atualização automática segura...");
      const now = Date.now();
      let lastReload = 0;
      try {
        lastReload = parseInt(sessionStorage.getItem('davvero_sw_last_reload') || '0', 10);
      } catch {}
      if (now - lastReload < 12000) {
        console.log("[App] Atualização recente evitada pelo circuit breaker.");
        return;
      }
      try {
        sessionStorage.setItem('davvero_sw_last_reload', String(now));
      } catch {}

      setIsLoopBlocked(false);
      setIsUpdating(true);
      setUpdateProgress(30);

      try {
        await clearAppCaches();
      } catch {}
      setUpdateProgress(80);

      setTimeout(async () => {
        setUpdateProgress(100);
        await safeReloadApp();
      }, 400);
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('online', onVisibilityOrFocus);
    window.addEventListener('swUpdated', onServiceWorkerUpdated);
    window.addEventListener('swNeedRefresh', onServiceWorkerUpdated);

    return () => {
      clearInterval(versionInterval);
      stopPresence();
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('online', onVisibilityOrFocus);
      window.removeEventListener('swUpdated', onServiceWorkerUpdated);
      window.removeEventListener('swNeedRefresh', onServiceWorkerUpdated);
    };
  }, [performSafeVersionCheck, settings?.version]);

  const handleGlobalVerify = (code: string) => {
    setTargetVerifyCode(code);
    switchTab("verifier");
  };

  const handleAdminForceView = (code: string) => {
    setAdminForceViewCode(code);
    switchTab("student");
  };

  const handleUpdateClick = () => {
    localStorage.setItem("last_seen_app_version", APP_VERSION);
    setShowUpdateModal(false);
  };

  const handleCloseUpdate = () => {
    localStorage.setItem("last_seen_app_version", APP_VERSION);
    setShowUpdateModal(false);
  };

  useEffect(() => {
    // Expose global triggers for deep components
    (window as any).triggerVerification = handleGlobalVerify;
    (window as any).triggerAdminForceView = handleAdminForceView;
    (window as any).triggerTab = (tab: any) => switchTab(tab);
    (window as any).triggerStudentTab = (subTab?: string) => {
      if (subTab) {
        sessionStorage.setItem("student_target_tab", subTab);
        window.dispatchEvent(new CustomEvent("openStudentTab", { detail: { tab: subTab } }));
      }
      switchTab("student");
    };
    (window as any).triggerWelcomeModal = () => setShowWelcomeModal(true);
    (window as any).triggerCheckUpdates = handleInteractiveUpdateCheck;
    (window as any).forceCacheStudentPortalResources = () => forceCacheStudentPortalResources(settings);

    // Listener para redirecionamento imediato disparado por cliques em notificações (SW e links)
    const handleUrlNavigation = (rawUrl?: string) => {
      try {
        const currentUrl = rawUrl ? new URL(rawUrl, window.location.origin) : new URL(window.location.href);
        const params = currentUrl.searchParams;

        if (params.has("cert") || params.has("verify")) {
          const code = params.get("cert") || params.get("verify");
          if (code) {
            setTargetVerifyCode(code);
            switchTab("verifier");
          }
          return;
        }

        const tab = params.get("tab") || params.get("view");
        if (tab === "events" || tab === "eventos" || params.has("event") || params.has("checkin")) {
          switchTab("events");
        } else if (
          tab === "student" ||
          tab === "aluno" ||
          tab === "carteirinha" ||
          tab === "certificates" ||
          tab === "certificados" ||
          params.has("certEvent") ||
          params.has("eventId") ||
          params.has("certType")
        ) {
          switchTab("student");
          if (tab === "certificates" || tab === "certificados" || params.get("subTab") === "certificates") {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("openStudentTab", { detail: { tab: "certificates" } }));
            }, 80);
          }
        } else if (tab === "diocese") {
          switchTab("diocese");
        } else if (tab === "appointments" || tab === "agendamentos") {
          switchTab("appointments");
        } else if (tab === "courses" || tab === "cursos") {
          switchTab("courses");
        } else if (tab === "admin") {
          switchTab("admin");
        }
      } catch (e) {
        console.warn("handleUrlNavigation error:", e);
      }
    };

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NAVIGATE_URL" && event.data.url) {
        handleUrlNavigation(event.data.url);
      }
    };

    const handlePopState = () => {
      handleUrlNavigation();
    };

    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }
    window.addEventListener("popstate", handlePopState);

    return () => {
      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
      window.removeEventListener("popstate", handlePopState);
    };
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
      // Se offline, não bloqueia e nem dispara retentativas desnecessárias de rede
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        (window as any).db_connected = false;
        return;
      }

      const success = await loginAnon();
      if (!success && retries > 0) {
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
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
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        console.warn(
          `Firestore server test failed. Retrying in 5s... (${retries} left)`,
        );
        setTimeout(() => initFirebase(retries - 1), 5000);
      }
    };
    initFirebase();

    const handleOnlineReconnect = () => {
      initFirebase(2);
      forceCacheStudentPortalResources(settings);
    };
    window.addEventListener("online", handleOnlineReconnect);

    return () => {
      systemPrefersDark.removeEventListener("change", themeListener);
      window.removeEventListener("online", handleOnlineReconnect);
    };
  }, [settings]);

  const hasPrecachedStudentPortalRef = useRef(false);

  // Forçar o cache de todos os recursos necessários para a StudentPortal durante o primeiro carregamento com sucesso
  useEffect(() => {
    if (!isOnline) return;
    if (hasPrecachedStudentPortalRef.current) return;
    hasPrecachedStudentPortalRef.current = true;

    let timer: any = null;
    const executePrecache = () => {
      forceCacheStudentPortalResources(settings);
    };

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(executePrecache, { timeout: 2500 });
      } else {
        timer = setTimeout(executePrecache, 1200);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOnline, settings]);

  return (
    <ErrorBoundary>
    <div className="min-h-screen relative flex flex-col items-center p-0 sm:p-4 print:block print:p-0">
      <OfflineNotice 
        showModalExternally={showOfflineInfoModal}
        onCloseExternalModal={() => setShowOfflineInfoModal(false)}
      />
      <VersionUpdateGate
        isUpdating={isUpdating}
        updateProgress={updateProgress}
        targetVersion={targetVersionText}
        isLoopBlocked={isLoopBlocked}
        onDismissBlocked={() => {
          setIsLoopBlocked(false);
          userDismissedGateRef.current = true;
          try {
            sessionStorage.setItem("davvero_gate_dismissed", "true");
          } catch (_) {}
        }}
      />
      <DynamicPWA />
      <NotificationObserver />
      <div className="my-auto w-full max-w-3xl glass-panel rounded-none sm:rounded-3xl p-3 sm:p-5 md:p-10 animated-fade-in relative overflow-hidden print:max-w-none print:p-0 print:shadow-none print:bg-white print:dark:bg-white min-h-[100dvh] sm:min-h-0 print:min-h-0 print:border-none print:block">
        {/* Glows Decorativos de Fundo */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-sky-300 dark:bg-sky-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-300 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-[90px] opacity-30 pointer-events-none print:hidden" />

        {/* MODAL DE BOAS-VINDAS */}
        <WelcomeModal 
          isOpen={showWelcomeModal && !isUpdating && !showUpdateModal}
          onClose={() => {
            localStorage.setItem("has_seen_welcome", "true");
            setShowWelcomeModal(false);
          }} 
        />

        <AnimatePresence>
          {/* MODAL DE BUSCA INTERATIVA DE ATUALIZAÇÕES */}
          {updateCheckModal.isOpen && (
            <motion.div
              key="update-check-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-0 left-0 w-full h-[100dvh] z-[120] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print"
            >
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden">
                {updateCheckModal.status !== "searching" && (
                  <button
                    onClick={() => setUpdateCheckModal(prev => ({ ...prev, isOpen: false }))}
                    className="absolute top-3 right-3 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {updateCheckModal.status === "searching" && (
                  <div className="py-4 space-y-4">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-ping" />
                      <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
                        <RefreshCw className="w-7 h-7 animate-spin" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        Buscando Atualizações...
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {updateCheckModal.message}
                      </p>
                    </div>
                    <div className="w-3/4 mx-auto bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full w-full animate-pulse" />
                    </div>
                  </div>
                )}

                {updateCheckModal.status === "up_to_date" && (
                  <div className="py-2 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-inner">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        Aplicativo Atualizado!
                      </h3>
                      <span className="inline-block px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                        Versão {APP_VERSION}
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">
                        {updateCheckModal.message}
                      </p>
                    </div>
                    <div className="pt-2 space-y-2">
                      <button
                        onClick={() => handleForceReloadAndSync(updateCheckModal.serverVersion)}
                        className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Forçar Sincronização & Recarregar
                      </button>
                      <button
                        onClick={() => {
                          setUpdateCheckModal(prev => ({ ...prev, isOpen: false }));
                          setShowUpdateModal(true);
                        }}
                        className="w-full py-2.5 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-bold rounded-xl border border-sky-200 dark:border-sky-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Ver Novidades da Versão
                      </button>
                      <button
                        onClick={() => setUpdateCheckModal(prev => ({ ...prev, isOpen: false }))}
                        className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-98 cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}

                {updateCheckModal.status === "outdated" && (
                  <div className="py-2 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 mx-auto shadow-inner">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        Nova Versão Disponível!
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {updateCheckModal.message}
                      </p>
                    </div>
                    <div className="w-3/4 mx-auto bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full w-2/3 animate-pulse rounded-full" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* MODAL DE NOVIDADES DA VERSÃO ATUALIZADA */}
          {!isUpdating && showUpdateModal && (
            <motion.div
              key="update-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print"
            >
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 border border-sky-100 dark:border-sky-500/20 text-center relative max-h-[88vh] flex flex-col overflow-hidden">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={handleCloseUpdate}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-sky-100 dark:bg-sky-500/20 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-6 h-6" />
                  </div>

                  <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-0.5">
                    Aplicativo Atualizado!
                  </h2>
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <span className="px-2.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 rounded-full text-[10px] uppercase tracking-wider font-black">
                      Versão {APP_VERSION}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Confira as novidades implementadas nesta versão:
                  </p>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 text-left space-y-2.5 mb-4">
                  {CHANGELOG.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex gap-2.5 items-start p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="w-2 h-2 rounded-full bg-sky-500 mt-1 shrink-0" />
                      <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex-shrink-0 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleUpdateClick}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Entendido & Explorar Novidades
                  </button>
                  <button
                    onClick={() => {
                      handleCloseUpdate();
                      handleInteractiveUpdateCheck();
                    }}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Buscar Novas Atualizações
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 space-y-6 sm:space-y-8 print:space-y-4">
          <Header onOpenAdmin={handleOpenAdmin} />

          {/* PAINEL EXPLICATIVO MODO OFFLINE COMPLETO */}
          {!isOnline && (
            <div 
              id="offline-complete-mode-panel"
              className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-700/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-100 shadow-sm print:hidden animate-fade-in"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-amber-900 dark:text-amber-200">
                    Modo Offline Completo Ativo
                  </p>
                  <p className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-300/90 leading-tight">
                    Sua Carteirinha (Minha ID), dados salvos e verificação continuam operando normalmente em cache local. Links e ações que exigem internet foram pausados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineInfoModal(true)}
                className="self-end sm:self-center shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Ver O Que Funciona</span>
              </button>
            </div>
          )}

          {isQuotaExhausted && (
            <div className="px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 print:hidden transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>
                  <strong>Modo Offline/Cache Ativo:</strong> Cota do banco em nuvem (plano gratuito) atingida temporariamente. O sistema permanece 100% operacional com dados salvos em cache local.
                </span>
              </div>
            </div>
          )}

          {settings.headerLogoEnabled && settings.headerLogoUrl && (
            <div className="flex flex-col items-center justify-center gap-4 mb-4 mt-2 sm:mt-0 no-print print:hidden">
              <a 
                href={isFacultyLive ? liveTargetUrl : (settings.headerLogoLink || "#")} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`relative group inline-block transition-all duration-300 ${
                  isFacultyLive 
                    ? "cursor-pointer hover:scale-105 active:scale-95" 
                    : "max-w-[200px] hover:opacity-90 transition-opacity"
                }`}
                title={isFacultyLive ? `🔴 FAJOPA está AO VIVO! Clique para assistir à transmissão` : undefined}
              >
                {isFacultyLive ? (
                  /* Instagram-style LIVE ring around FAJOPA logo */
                  <div className="relative inline-flex items-center justify-center p-[3.5px] rounded-3xl sm:rounded-[28px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-lg shadow-rose-500/30">
                    {/* Pulsing ring aura */}
                    <div className="absolute -inset-1 rounded-3xl sm:rounded-[30px] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] opacity-60 blur-xs animate-pulse -z-10" />

                    {/* Inner image container */}
                    <div className="relative bg-white dark:bg-slate-900 rounded-[22px] sm:rounded-[24px] p-2.5 sm:p-3 overflow-hidden flex items-center justify-center max-w-[200px] sm:max-w-[220px]">
                      <img 
                        src={settings.headerLogoUrl} 
                        alt="FAJOPA Ao Vivo" 
                        className="w-full h-auto object-contain drop-shadow-sm" 
                      />
                    </div>

                    {/* Instagram-style "LIVE" badge overlapping the bottom border */}
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white font-black text-[10px] sm:text-[11px] tracking-widest uppercase shadow-md shadow-red-600/40 border-2 border-white dark:border-slate-900 whitespace-nowrap">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                      </span>
                      <span>LIVE</span>
                    </div>
                  </div>
                ) : (
                  <img src={settings.headerLogoUrl} alt="Logo" className="w-full h-auto object-contain drop-shadow-sm" />
                )}
              </a>

              {(settings.socialFacebookEnabled || settings.socialInstagramEnabled || settings.socialYoutubeEnabled || settings.socialWhatsappEnabled || settings.socialEmailEnabled) && (
                <div className="flex flex-row items-center justify-center gap-3">
                  {settings.socialFacebookEnabled && (
                    <a 
                      href={isOnline ? settings.socialFacebookUrl : undefined} 
                      target={isOnline ? "_blank" : undefined} 
                      rel={isOnline ? "noopener noreferrer" : undefined} 
                      onClick={(e) => {
                        if (!isOnline) {
                          e.preventDefault();
                          setShowOfflineInfoModal(true);
                        }
                      }}
                      className={`p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors ${
                        isOnline ? "text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer" : "text-slate-400 opacity-50 cursor-not-allowed"
                      }`} 
                      aria-label="Facebook"
                      title={!isOnline ? "Requer conexão à internet" : undefined}
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialInstagramEnabled && (
                    <a 
                      href={isOnline ? settings.socialInstagramUrl : undefined} 
                      target={isOnline ? "_blank" : undefined} 
                      rel={isOnline ? "noopener noreferrer" : undefined} 
                      onClick={(e) => {
                        if (!isOnline) {
                          e.preventDefault();
                          setShowOfflineInfoModal(true);
                        }
                      }}
                      className={`p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors ${
                        isOnline ? "text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/20 cursor-pointer" : "text-slate-400 opacity-50 cursor-not-allowed"
                      }`} 
                      aria-label="Instagram"
                      title={!isOnline ? "Requer conexão à internet" : undefined}
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialYoutubeEnabled && (
                    <a 
                      href={isOnline ? settings.socialYoutubeUrl : undefined} 
                      target={isOnline ? "_blank" : undefined} 
                      rel={isOnline ? "noopener noreferrer" : undefined} 
                      onClick={(e) => {
                        if (!isOnline) {
                          e.preventDefault();
                          setShowOfflineInfoModal(true);
                        }
                      }}
                      className={`p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors ${
                        isOnline ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer" : "text-slate-400 opacity-50 cursor-not-allowed"
                      }`} 
                      aria-label="YouTube"
                      title={!isOnline ? "Requer conexão à internet" : undefined}
                    >
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialWhatsappEnabled && (
                    <a 
                      href={isOnline ? settings.socialWhatsappUrl : undefined} 
                      target={isOnline ? "_blank" : undefined} 
                      rel={isOnline ? "noopener noreferrer" : undefined} 
                      onClick={(e) => {
                        if (!isOnline) {
                          e.preventDefault();
                          setShowOfflineInfoModal(true);
                        }
                      }}
                      className={`p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors ${
                        isOnline ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer" : "text-slate-400 opacity-50 cursor-not-allowed"
                      }`} 
                      aria-label="WhatsApp"
                      title={!isOnline ? "Requer conexão à internet" : undefined}
                    >
                      <MessageCircle className="w-5 h-5" />
                    </a>
                  )}
                  {settings.socialEmailEnabled && (
                    <a 
                      href={isOnline ? settings.socialEmailUrl : undefined} 
                      target={isOnline ? "_blank" : undefined} 
                      rel={isOnline ? "noopener noreferrer" : undefined} 
                      onClick={(e) => {
                        if (!isOnline) {
                          e.preventDefault();
                          setShowOfflineInfoModal(true);
                        }
                      }}
                      className={`p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors ${
                        isOnline ? "text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/20 cursor-pointer" : "text-slate-400 opacity-50 cursor-not-allowed"
                      }`} 
                      aria-label="Email"
                      title={!isOnline ? "Requer conexão à internet" : undefined}
                    >
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
                href={isOnline ? settings.fajopaPlusUrl : undefined}
                target={isOnline ? "_blank" : undefined}
                rel={isOnline ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  if (!isOnline) {
                    e.preventDefault();
                    setShowOfflineInfoModal(true);
                  }
                }}
                className={`relative group flex items-center justify-center py-4 w-full max-w-sm rounded-2xl bg-white dark:bg-[#020617] text-slate-900 dark:text-white font-black uppercase tracking-widest overflow-hidden transition-all duration-500 shadow-[0_0_20px_rgba(56,189,248,0.15)] border border-slate-200 dark:border-slate-800 ${
                  isOnline 
                    ? "hover:scale-[1.02] active:scale-95 hover:shadow-[0_0_30px_rgba(56,189,248,0.3)] cursor-pointer" 
                    : "opacity-60 grayscale cursor-not-allowed"
                }`}
                title={!isOnline ? "Indisponível sem conexão à internet" : undefined}
              >
                {/* Animated Gradient Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                
                {/* Glitch/Neon Text Container */}
                <div className="relative z-10 flex items-center gap-2 drop-shadow-md text-xl sm:text-2xl">
                  <span className="text-slate-900 dark:text-white drop-shadow-md glitch-text-hover-only">FAJOPA</span>
                  <span className="text-[#3b82f6] drop-shadow-md">PLUS</span>
                  {!isOnline && (
                    <span className="ml-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-md normal-case tracking-normal">
                      Requer Web
                    </span>
                  )}
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
                  href={isOnline ? settings.sophiaLink : undefined} 
                  target={isOnline ? "_blank" : undefined}
                  rel={isOnline ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (!isOnline) {
                      e.preventDefault();
                      setShowOfflineInfoModal(true);
                    }
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group ${
                    isOnline 
                      ? "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 cursor-pointer" 
                      : "text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                  }`}
                  title={!isOnline ? "Disponível apenas online (Portal Externo)" : undefined}
                >
                  <User className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">
                    Portal do Aluno
                    {!isOnline && <span className="block text-[8px] font-normal opacity-70">(Online)</span>}
                  </span>
                </a>
              )}
              {settings.libraryEnabled && (
                <a 
                  href={isOnline ? settings.libraryLink : undefined} 
                  target={isOnline ? "_blank" : undefined}
                  rel={isOnline ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (!isOnline) {
                      e.preventDefault();
                      setShowOfflineInfoModal(true);
                    }
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group ${
                    isOnline 
                      ? "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 cursor-pointer" 
                      : "text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                  }`}
                  title={!isOnline ? "Disponível apenas online (Biblioteca Externa)" : undefined}
                >
                  <BookHeart className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">
                    Biblioteca Virtual
                    {!isOnline && <span className="block text-[8px] font-normal opacity-70">(Online)</span>}
                  </span>
                </a>
              )}
              {settings.avaEnabled && (
                <a 
                  href={isOnline ? settings.avaLink : undefined} 
                  target={isOnline ? "_blank" : undefined}
                  rel={isOnline ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (!isOnline) {
                      e.preventDefault();
                      setShowOfflineInfoModal(true);
                    }
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group ${
                    isOnline 
                      ? "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 cursor-pointer" 
                      : "text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                  }`}
                  title={!isOnline ? "Disponível apenas online (Ambiente Moodle)" : undefined}
                >
                  <MonitorPlay className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">
                    Ambiente Virtual
                    {!isOnline && <span className="block text-[8px] font-normal opacity-70">(Online)</span>}
                  </span>
                </a>
              )}
              {settings.contemplacaoEnabled && (
                <a 
                  href={isOnline ? settings.contemplacaoLink : undefined} 
                  target={isOnline ? "_blank" : undefined}
                  rel={isOnline ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (!isOnline) {
                      e.preventDefault();
                      setShowOfflineInfoModal(true);
                    }
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-white dark:bg-slate-800/50 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 border border-slate-200 dark:border-slate-700/50 min-w-0 text-center group ${
                    isOnline 
                      ? "text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:-translate-y-1 hover:shadow-md active:scale-95 cursor-pointer" 
                      : "text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                  }`}
                  title={!isOnline ? "Disponível apenas online (Portal Externo)" : undefined}
                >
                  <BookOpen className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="w-full px-1 leading-tight whitespace-normal">
                    Revista Contemplação
                    {!isOnline && <span className="block text-[8px] font-normal opacity-70">(Online)</span>}
                  </span>
                </a>
              )}
            </div>
          )}

            <div 
              className="grid bg-slate-200/50 dark:bg-slate-900/60 rounded-xl p-1 shadow-inner border border-slate-200/50 dark:border-slate-700/50 no-print print:hidden gap-1"
              style={{ gridTemplateColumns: `repeat(${3 + (settings.eventsEnabled !== false ? 1 : 0) + (settings.appointmentsEnabled !== false ? 1 : 0) + (settings.coursesEnabled !== false ? 1 : 0)}, minmax(0, 1fr))` }}
            >
              <button
                onClick={() => {
                  switchTab("student");
                  window.dispatchEvent(new CustomEvent("openStudentTab", { detail: { tab: "id" } }));
                }}
                onMouseEnter={() => prefetchTab("student")}
                onMouseLeave={cancelPrefetch}
                onTouchStart={() => prefetchTab("student", 120)}
                className={`relative flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                  activeTab === "student"
                    ? "bg-white dark:bg-amber-500 text-amber-600 dark:text-amber-50 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <User className="w-4 h-4 mb-0.5" />
                <span>Minha ID</span>
                {!isOnline && (
                  <span className="text-[7px] font-extrabold text-emerald-600 dark:text-emerald-300 -mt-0.5">
                    Offline OK
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  if (!isOnline) {
                    setShowOfflineInfoModal(true);
                    return;
                  }
                  switchTab("verifier");
                }}
                onMouseEnter={cancelPrefetch}
                className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                  !isOnline
                    ? "opacity-35 cursor-not-allowed text-slate-400"
                    : activeTab === "verifier"
                    ? "bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title={!isOnline ? "Requer conexão à internet para validar" : undefined}
              >
                <Shield className="w-4 h-4 mb-0.5" />
                <span>Verificar</span>
                {!isOnline && (
                  <span className="text-[7px] font-medium text-slate-400 -mt-0.5">
                    (Online)
                  </span>
                )}
              </button>
              {settings.coursesEnabled !== false && (
                <button
                  onClick={() => {
                    if (!isOnline) {
                      setShowOfflineInfoModal(true);
                      return;
                    }
                    switchTab("courses");
                  }}
                  onMouseEnter={() => prefetchTab("courses")}
                  onMouseLeave={cancelPrefetch}
                  onTouchStart={() => prefetchTab("courses", 120)}
                  className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                    !isOnline
                      ? "opacity-35 cursor-not-allowed text-slate-400"
                      : activeTab === "courses"
                      ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  title={!isOnline ? "Requer conexão à internet" : undefined}
                >
                  <GraduationCap className="w-4 h-4 mb-0.5" />
                  <span className="hidden sm:inline">Cursos & Ofertas</span>
                  <span className="sm:hidden">Cursos</span>
                  {!isOnline && (
                    <span className="text-[7px] font-medium text-slate-400 -mt-0.5">
                      (Online)
                    </span>
                  )}
                </button>
              )}
              {settings.eventsEnabled !== false && (
                <button
                  onClick={() => {
                    if (!isOnline) {
                      setShowOfflineInfoModal(true);
                      return;
                    }
                    switchTab("events");
                  }}
                  onMouseEnter={() => prefetchTab("events")}
                  onMouseLeave={cancelPrefetch}
                  onTouchStart={() => prefetchTab("events", 120)}
                  className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                    !isOnline
                      ? "opacity-35 cursor-not-allowed text-slate-400"
                      : activeTab === "events"
                      ? "bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  title={!isOnline ? "Requer conexão à internet" : undefined}
                >
                  <Calendar className="w-4 h-4 mb-0.5" />
                  <span>Eventos</span>
                  {!isOnline && (
                    <span className="text-[7px] font-medium text-slate-400 -mt-0.5">
                      (Online)
                    </span>
                  )}
                </button>
              )}
              {settings.appointmentsEnabled !== false && (
                <button
                  onClick={() => {
                    if (!isOnline) {
                      setShowOfflineInfoModal(true);
                      return;
                    }
                    switchTab("appointments");
                  }}
                  onMouseEnter={() => prefetchTab("appointments")}
                  onMouseLeave={cancelPrefetch}
                  onTouchStart={() => prefetchTab("appointments", 120)}
                  className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                    !isOnline
                      ? "opacity-35 cursor-not-allowed text-slate-400"
                      : activeTab === "appointments"
                      ? "bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                  title={!isOnline ? "Requer conexão à internet" : undefined}
                >
                  <HeartHandshake className="w-4 h-4 mb-0.5" />
                  <span>Seminário</span>
                  {!isOnline && (
                    <span className="text-[7px] font-medium text-slate-400 -mt-0.5">
                      (Online)
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  if (!isOnline) {
                    setShowOfflineInfoModal(true);
                    return;
                  }
                  switchTab("diocese");
                }}
                onMouseEnter={() => prefetchTab("diocese")}
                onMouseLeave={cancelPrefetch}
                onTouchStart={() => prefetchTab("diocese", 120)}
                className={`flex flex-col items-center justify-center py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${
                  !isOnline
                    ? "opacity-35 cursor-not-allowed text-slate-400"
                    : activeTab === "diocese"
                    ? "bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title={!isOnline ? "Requer conexão à internet" : undefined}
              >
                <Landmark className="w-4 h-4 mb-0.5" />
                <span>Minha Diocese</span>
                {!isOnline && (
                  <span className="text-[7px] font-medium text-slate-400 -mt-0.5">
                    (Online)
                  </span>
                )}
              </button>
            </div>

          <div className="w-full">
            <Suspense
              fallback={
                <div className="flex justify-center p-10">
                  <Loader2 className="animate-spin text-sky-500 w-8 h-8" />
                </div>
              }
            >
              {activeTab === "verifier" && (
                <div className="space-y-6">
                  <div id="certificate-verifier-root" className="scroll-mt-6">
                    <Verifier
                      externalCode={targetVerifyCode}
                      onExternalVerified={handleExternalVerified}
                    />
                  </div>
                  {!targetVerifyCode && <HomePollsWidget />}
                </div>
              )}

              {activeTab === "admin" && (
                <div id="admin-section" className="scroll-mt-20">
                  <Admin />
                </div>
              )}

              {activeTab === "events" && (
                <EventsPage onNavigateToStudent={handleStudentNavigate} />
              )}

              {activeTab === "appointments" && (
                <PublicAppointmentsList member={null} onNavigateToStudent={handleStudentNavigate} />
              )}

              {activeTab === "courses" && (
                <CoursesOffers
                  onNavigateToStudent={handleStudentNavigate}
                  onNavigateToDiocese={handleDioceseNavigate}
                />
              )}

              {activeTab === "diocese" && (
                <DioceseHub
                  member={null}
                  onNavigateToEvents={handleEventsNavigate}
                />
              )}

              {activeTab === "student" && (
                <StudentPortal
                  overrideCode={adminForceViewCode}
                  onOverrideConsumed={handleOverrideConsumed}
                />
              )}
            </Suspense>
          </div>

          <Footer />
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
