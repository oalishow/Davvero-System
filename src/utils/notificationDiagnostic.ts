/**
 * Notification Diagnostic Utility
 * Realiza testes, diagnóstico e suporte especializado para Mobile e Desktop
 * na inscrição de notificações Web Push.
 */

export const DEFAULT_VAPID_PUBLIC_KEY =
  "BExGkxEI0iWpLyDIDONDcUaHlIb3f_gGODmxL9LRkLT3qoWd0zpZhgFHA2c1c6sKIsRL9kLh4fpZ1maZg_CLELk";

export interface MobileEnvironmentInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  isInIframe: boolean;
  isSecureContext: boolean;
  pushSupported: boolean;
  notificationSupported: boolean;
  swSupported: boolean;
}

export interface NotificationDiagnosticReport {
  timestamp: string;
  environment: {
    isSecureContext: boolean;
    isInIframe: boolean;
    isMobile: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isStandalone: boolean;
    userAgent: string;
    protocol: string;
    host: string;
  };
  permissions: {
    notificationSupported: boolean;
    state: NotificationPermission | "unsupported";
    isGranted: boolean;
  };
  serviceWorker: {
    swSupported: boolean;
    pushManagerSupported: boolean;
    hasActiveRegistration: boolean;
    registrationScope?: string;
    swState?: string;
  };
  vapid: {
    keySource: "server" | "fallback" | "failed";
    publicKeyPreview: string;
    isValidFormat: boolean;
    byteLength: number;
    error?: string;
  };
  subscription: {
    isSubscribed: boolean;
    endpointPreview?: string;
    hasKeys?: boolean;
    rawSubscription?: PushSubscription | null;
  };
}

/**
 * Detecta o ambiente do dispositivo móvel ou desktop
 */
export function detectMobileEnvironment(): MobileEnvironmentInfo {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true ||
      (typeof document !== "undefined" && document.referrer.includes("android-app://")));
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;
  const isSecureContext = typeof window !== "undefined" ? window.isSecureContext === true : false;
  const notificationSupported = typeof window !== "undefined" && "Notification" in window;
  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const pushSupported = typeof window !== "undefined" && "PushManager" in window;

  return {
    isMobile: isIOS || isAndroid,
    isIOS,
    isAndroid,
    isStandalone,
    isInIframe,
    isSecureContext,
    pushSupported,
    notificationSupported,
    swSupported,
  };
}

/**
 * Converte chave base64 VAPID para Uint8Array com validação estrita
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Solicitação direta e imediata de permissão de notificação
 * CRÍTICO PARA MOBILE: Deve ser executada logo no início do toque/clique
 * sem awaits prévios de rede para não perder o User Gesture Token do navegador.
 */
export async function requestNotificationPermissionDirect(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  // Se já estiver concedida, não precisa reabrir diálogo
  if (Notification.permission === "granted") {
    return "granted";
  }

  try {
    const result = Notification.requestPermission();
    if (result && typeof result.then === "function") {
      return await result;
    }
  } catch (err) {
    console.warn("[Push] Falha na requisição Promise de permissão, tentando fallback callback:", err);
  }

  return new Promise<NotificationPermission>((resolve) => {
    try {
      Notification.requestPermission((res) => {
        resolve(res || Notification.permission);
      });
    } catch {
      resolve(Notification.permission);
    }
  });
}

/**
 * Obtém a chave VAPID com fallback seguro contra respostas HTML ou servidores em inicialização
 */
export async function getVapidPublicKeySafe(): Promise<{
  key: string;
  source: "server" | "fallback";
  error?: string;
}> {
  try {
    const res = await fetch("/api/push/public-key", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const contentType = res.headers.get("content-type") || "";

    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && typeof data.publicKey === "string" && data.publicKey.trim().length > 20) {
        return { key: data.publicKey.trim(), source: "server" };
      }
    }

    return {
      key: DEFAULT_VAPID_PUBLIC_KEY,
      source: "fallback",
      error: `Endpoint retornou HTTP ${res.status} (${contentType || "non-json"}). Utilizando chave padrão.`,
    };
  } catch (err: any) {
    return {
      key: DEFAULT_VAPID_PUBLIC_KEY,
      source: "fallback",
      error: err?.message || "Falha na requisição de rede.",
    };
  }
}

/**
 * Garante que o Service Worker está totalmente ativo (activated)
 * Evita o erro 'InvalidStateError: Registration failed - no active Service Worker' em navegadores mobile.
 */
export async function ensureActiveServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service Worker não é suportado neste navegador.");
  }

  let reg = await navigator.serviceWorker.getRegistration();

  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    } catch (e) {
      console.warn("[ensureActiveServiceWorker] Tentativa de registro:", e);
    }
  }

  // Aguarda a resolução do SW pronto
  const readyReg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((resolve) => {
      setTimeout(() => {
        if (reg) resolve(reg);
      }, 3500);
    }),
  ]);

  const finalReg = readyReg || reg;
  if (!finalReg) {
    throw new Error("Não foi possível inicializar o Service Worker.");
  }

  // Se estiver instalando ou esperando, aguardar transição para ativado
  if (!finalReg.active && (finalReg.installing || finalReg.waiting)) {
    const sw = finalReg.installing || finalReg.waiting;
    if (sw) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated" || finalReg.active) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
  }

  return finalReg;
}

/**
 * Executa o diagnóstico completo e gera logs estruturados no console
 */
export async function runAndLogNotificationDiagnostics(
  context: string = "Toggle"
): Promise<NotificationDiagnosticReport> {
  const env = detectMobileEnvironment();

  let currentPermission: NotificationPermission | "unsupported" = "unsupported";
  if (env.notificationSupported) {
    currentPermission = Notification.permission;
  }

  let swActive = false;
  let regScope: string | undefined;
  let swState: string | undefined;
  let existingSub: PushSubscription | null = null;

  if (env.swSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swActive = Boolean(reg.active);
        regScope = reg.scope;
        swState = reg.active?.state || reg.installing?.state || reg.waiting?.state;
        if (env.pushSupported && reg.pushManager) {
          existingSub = await reg.pushManager.getSubscription();
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // VAPID Validation
  const vapidInfo = await getVapidPublicKeySafe();
  let isValidFormat = false;
  let byteLen = 0;
  try {
    const uint8 = urlBase64ToUint8Array(vapidInfo.key);
    isValidFormat = uint8.length > 0;
    byteLen = uint8.length;
  } catch (err: any) {
    isValidFormat = false;
  }

  const report: NotificationDiagnosticReport = {
    timestamp: new Date().toISOString(),
    environment: {
      isSecureContext: env.isSecureContext,
      isInIframe: env.isInIframe,
      isMobile: env.isMobile,
      isIOS: env.isIOS,
      isAndroid: env.isAndroid,
      isStandalone: env.isStandalone,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
      protocol: typeof location !== "undefined" ? location.protocol : "N/A",
      host: typeof location !== "undefined" ? location.host : "N/A",
    },
    permissions: {
      notificationSupported: env.notificationSupported,
      state: currentPermission,
      isGranted: currentPermission === "granted",
    },
    serviceWorker: {
      swSupported: env.swSupported,
      pushManagerSupported: env.pushSupported,
      hasActiveRegistration: swActive,
      registrationScope: regScope,
      swState,
    },
    vapid: {
      keySource: vapidInfo.source,
      publicKeyPreview: `${vapidInfo.key.substring(0, 12)}...${vapidInfo.key.slice(-8)}`,
      isValidFormat,
      byteLength: byteLen,
      error: vapidInfo.error,
    },
    subscription: {
      isSubscribed: Boolean(existingSub),
      endpointPreview: existingSub?.endpoint
        ? `${existingSub.endpoint.substring(0, 40)}...`
        : undefined,
      hasKeys: Boolean(existingSub?.toJSON().keys),
      rawSubscription: existingSub,
    },
  };

  // Styled Console Logging
  console.group(`🔔 [DAVVERO Push Diagnostic] - Trigger: ${context}`);

  console.log(
    `%c[1/4] Estado da Permissão:%c ${report.permissions.state.toUpperCase()} ${
      report.permissions.isGranted ? "✅" : "⚠️"
    }`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${report.permissions.isGranted ? "#22c55e" : "#f59e0b"}; font-weight: bold;`
  );
  if (env.isInIframe) {
    console.warn(
      "⚠️ Aviso: Aplicação executando dentro de um <iframe>. O navegador bloqueia diálogos de permissão de notificação."
    );
  }
  if (env.isIOS && !env.isStandalone) {
    console.warn(
      "⚠️ Aviso iOS: No Safari móvel, Web Push requer que o PWA seja adicionado à Tela de Início."
    );
  }

  console.log(
    `%c[2/4] Chave VAPID:%c ${
      report.vapid.isValidFormat ? "VÁLIDA" : "INVÁLIDA"
    } (${report.vapid.keySource.toUpperCase()}) %c[${report.vapid.publicKeyPreview}]`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${report.vapid.isValidFormat ? "#22c55e" : "#ef4444"}; font-weight: bold;`,
    "color: #64748b;"
  );
  if (report.vapid.error) {
    console.info(`ℹ️ Info VAPID: ${report.vapid.error}`);
  }

  console.log(
    `%c[3/4] Service Worker & PushManager:%c SW: ${
      swActive ? "ATIVO" : "PENDENTE"
    } | PushManager: ${env.pushSupported ? "DISPONÍVEL" : "INDISPONÍVEL"} | Mobile: ${
      env.isMobile ? (env.isIOS ? "iOS" : "Android") : "Desktop"
    }`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${swActive && env.pushSupported ? "#22c55e" : "#f59e0b"}; font-weight: bold;`
  );

  console.log(
    `%c[4/4] Subscrição Push Atual:%c ${
      report.subscription.isSubscribed ? "INSCRITO ATIVO ✅" : "NENHUMA SUBSCRIÇÃO ⚪"
    }`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${report.subscription.isSubscribed ? "#22c55e" : "#64748b"}; font-weight: bold;`
  );
  if (report.subscription.endpointPreview) {
    console.log(`📡 Endpoint: ${report.subscription.endpointPreview}`);
  }

  console.table({
    Permissão: report.permissions.state,
    "VAPID Válida": report.vapid.isValidFormat,
    "Origem VAPID": report.vapid.keySource,
    "SW Ativo": report.serviceWorker.hasActiveRegistration,
    PushManager: report.serviceWorker.pushManagerSupported,
    Inscrito: report.subscription.isSubscribed,
    Dispositivo: env.isMobile ? (env.isIOS ? "iOS" : "Android") : "Desktop",
    "App Instalado (PWA)": env.isStandalone,
    "Em Iframe": report.environment.isInIframe,
    "HTTPS / Seguro": report.environment.isSecureContext,
  });

  console.groupEnd();

  return report;
}
