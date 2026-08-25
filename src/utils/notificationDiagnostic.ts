/**
 * Notification Diagnostic Utility
 * Realiza testes e registra no console do navegador o status detalhado da chave VAPID,
 * disponibilidade do serviço de push do navegador e estado de permissões.
 */

export const DEFAULT_VAPID_PUBLIC_KEY =
  "BExGkxEI0iWpLyDIDONDcUaHlIb3f_gGODmxL9LRkLT3qoWd0zpZhgFHA2c1c6sKIsRL9kLh4fpZ1maZg_CLELk";

export interface NotificationDiagnosticReport {
  timestamp: string;
  environment: {
    isSecureContext: boolean;
    isInIframe: boolean;
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
 * Obtém a chave VAPID com fallback seguro contra respostas HTML ou servidores em inicialização
 */
export async function getVapidPublicKeySafe(): Promise<{ key: string; source: "server" | "fallback"; error?: string }> {
  try {
    const res = await fetch("/api/push/public-key", {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    const contentType = res.headers.get("content-type") || "";

    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && typeof data.publicKey === "string" && data.publicKey.trim().length > 20) {
        return { key: data.publicKey.trim(), source: "server" };
      }
    }

    // Se o servidor retornou HTML (ex: index.html da SPA) ou status não-200
    return {
      key: DEFAULT_VAPID_PUBLIC_KEY,
      source: "fallback",
      error: `Endpoint retornou HTTP ${res.status} (${contentType || "non-json"}). Utilizando chave padrão.`
    };
  } catch (err: any) {
    return {
      key: DEFAULT_VAPID_PUBLIC_KEY,
      source: "fallback",
      error: err?.message || "Falha na requisição de rede."
    };
  }
}

/**
 * Executa o diagnóstico completo e gera logs estruturados no console
 */
export async function runAndLogNotificationDiagnostics(context: string = "Toggle"): Promise<NotificationDiagnosticReport> {
  const isSecureContext = typeof window !== "undefined" && window.isSecureContext === true;
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;
  const notificationSupported = typeof window !== "undefined" && "Notification" in window;
  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const pushManagerSupported = typeof window !== "undefined" && "PushManager" in window;

  let currentPermission: NotificationPermission | "unsupported" = "unsupported";
  if (notificationSupported) {
    currentPermission = Notification.permission;
  }

  let swActive = false;
  let regScope: string | undefined;
  let swState: string | undefined;
  let existingSub: PushSubscription | null = null;

  if (swSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swActive = Boolean(reg.active);
        regScope = reg.scope;
        swState = reg.active?.state || reg.installing?.state || reg.waiting?.state;
        if (pushManagerSupported && reg.pushManager) {
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
      isSecureContext,
      isInIframe,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
      protocol: typeof location !== "undefined" ? location.protocol : "N/A",
      host: typeof location !== "undefined" ? location.host : "N/A",
    },
    permissions: {
      notificationSupported,
      state: currentPermission,
      isGranted: currentPermission === "granted",
    },
    serviceWorker: {
      swSupported,
      pushManagerSupported,
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
      endpointPreview: existingSub?.endpoint ? `${existingSub.endpoint.substring(0, 40)}...` : undefined,
      hasKeys: Boolean(existingSub?.toJSON().keys),
      rawSubscription: existingSub,
    },
  };

  // Styled Console Logging
  console.group(`🔔 [DAVVERO Push Diagnostic] - Trigger: ${context}`);
  
  console.log(
    `%c[1/4] Estado da Permissão:%c ${report.permissions.state.toUpperCase()} ${report.permissions.isGranted ? '✅' : '⚠️'}`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${report.permissions.isGranted ? '#22c55e' : '#f59e0b'}; font-weight: bold;`
  );
  if (isInIframe) {
    console.warn("⚠️ Aviso: Aplicação executando dentro de um <iframe>. O navegador pode restringir diálogos de notificação.");
  }

  console.log(
    `%c[2/4] Chave VAPID:%c ${report.vapid.isValidFormat ? 'VÁLIDA' : 'INVÁLIDA'} (${report.vapid.keySource.toUpperCase()}) %c[${report.vapid.publicKeyPreview}]`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${report.vapid.isValidFormat ? '#22c55e' : '#ef4444'}; font-weight: bold;`,
    "color: #64748b;"
  );
  if (report.vapid.error) {
    console.info(`ℹ️ Info VAPID: ${report.vapid.error}`);
  }

  console.log(
    `%c[3/4] Service Worker & PushManager:%c SW: ${swActive ? 'ATIVO' : 'PENDENTE'} | PushManager: ${pushManagerSupported ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${swActive && pushManagerSupported ? '#22c55e' : '#f59e0b'}; font-weight: bold;`
  );

  console.log(
    `%c[4/4] Subscrição Push Atual:%c ${report.subscription.isSubscribed ? 'INSCRITO ATIVO ✅' : 'NENHUMA SUBSCRIÇÃO ⚪'}`,
    "color: #3b82f6; font-weight: bold;",
    `color: ${report.subscription.isSubscribed ? '#22c55e' : '#64748b'}; font-weight: bold;`
  );
  if (report.subscription.endpointPreview) {
    console.log(`📡 Endpoint: ${report.subscription.endpointPreview}`);
  }

  console.table({
    "Permissão": report.permissions.state,
    "VAPID Válida": report.vapid.isValidFormat,
    "Origem VAPID": report.vapid.keySource,
    "SW Ativo": report.serviceWorker.hasActiveRegistration,
    "PushManager": report.serviceWorker.pushManagerSupported,
    "Inscrito": report.subscription.isSubscribed,
    "Em Iframe": report.environment.isInIframe,
    "HTTPS / Seguro": report.environment.isSecureContext
  });

  console.groupEnd();

  return report;
}
