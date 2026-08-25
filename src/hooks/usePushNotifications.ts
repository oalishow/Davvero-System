import { useState, useEffect, useCallback } from "react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import {
  runAndLogNotificationDiagnostics,
  getVapidPublicKeySafe,
  urlBase64ToUint8Array,
  detectMobileEnvironment,
  requestNotificationPermissionDirect,
  ensureActiveServiceWorker,
  MobileEnvironmentInfo,
} from "../utils/notificationDiagnostic";

export interface DiagnosticLog {
  id: string;
  step: string;
  status: "ok" | "error" | "warn" | "info" | "running";
  message: string;
  detail?: string;
  timestamp: string;
}

export interface NotificationError {
  type:
    | "NETWORK_ERROR"
    | "PERMISSION_DENIED"
    | "VAPID_CONFIG_ERROR"
    | "UNSUPPORTED_BROWSER"
    | "SW_ERROR"
    | "IFRAME_RESTRICTION"
    | "IOS_PWA_REQUIRED"
    | "UNKNOWN";
  title: string;
  message: string;
  resolution: string;
  raw?: any;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [lastError, setLastError] = useState<NotificationError | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);
  const [mobileEnv, setMobileEnv] = useState<MobileEnvironmentInfo>(detectMobileEnvironment);

  const addLog = useCallback(
    (step: string, status: "ok" | "error" | "warn" | "info" | "running", message: string, detail?: string) => {
      const log: DiagnosticLog = {
        id: Math.random().toString(36).substring(2, 9),
        step,
        status,
        message,
        detail,
        timestamp: new Date().toLocaleTimeString(),
      };
      setDiagnosticLogs((prev) => [...prev, log]);
      const prefix = `[Push Diagnostic - ${step}]`;
      if (status === "error" || status === "warn") {
        console.warn(prefix, message, detail || "");
      } else {
        console.log(prefix, message, detail || "");
      }
      return log;
    },
    []
  );

  // Check initial browser capabilities and existing subscription
  useEffect(() => {
    const checkSupport = async () => {
      const env = detectMobileEnvironment();
      setMobileEnv(env);

      const supported = env.notificationSupported && env.swSupported && env.pushSupported;
      setIsSupported(supported);

      if (env.notificationSupported) {
        setPermission(Notification.permission);
      }

      if (supported) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.pushManager) {
            const existingSub = await reg.pushManager.getSubscription();
            if (existingSub) {
              setSubscription(existingSub);
              localStorage.setItem("davvero_push_subscribed", "true");
            }
          }
        } catch (e) {
          console.warn("[usePushNotifications] Erro ao checar subscrição existente:", e);
        }
      }
    };

    checkSupport();
  }, []);

  // Main subscription method - Optimized for Mobile Browsers & Direct Gestures
  const subscribe = async (): Promise<PushSubscription | null> => {
    setIsSubscribing(true);
    setLastError(null);
    setDiagnosticLogs([]);

    const env = detectMobileEnvironment();
    setMobileEnv(env);

    // 1. Check iOS Safari requirement (iOS only allows WebPush if added to Home Screen as PWA)
    if (env.isIOS && !env.isStandalone) {
      const err: NotificationError = {
        type: "IOS_PWA_REQUIRED",
        title: "Instalação Necessária no iPhone",
        message: "No iPhone/iPad (iOS), as notificações requerem que o aplicativo esteja instalado na Tela de Início.",
        resolution: "Toque no ícone de Compartilhar (quadrado com seta para cima) na barra do Safari e selecione 'Adicionar à Tela de Início'. Depois, abra o aplicativo pelo novo ícone.",
      };
      setLastError(err);
      addLog("Ambiente iOS", "warn", err.title, err.resolution);
      setIsSubscribing(false);
      return null;
    }

    // 2. Check Iframe restrictions
    if (env.isInIframe) {
      const err: NotificationError = {
        type: "IFRAME_RESTRICTION",
        title: "Visualização em Janela Embutida",
        message: "O navegador não permite solicitar permissão de notificações dentro de telas de pré-visualização.",
        resolution: "Abra o link do aplicativo em uma nova aba do navegador do seu celular.",
      };
      setLastError(err);
      addLog("Ambiente", "warn", err.title, err.resolution);
      setIsSubscribing(false);
      return null;
    }

    // 3. Check browser API support
    if (!env.notificationSupported || !env.swSupported) {
      const err: NotificationError = {
        type: "UNSUPPORTED_BROWSER",
        title: "Navegador incompatível",
        message: "Este navegador móvel não possui suporte ativo para notificações nativas.",
        resolution: "Utilize o Google Chrome, Edge ou Samsung Internet atualizado.",
      };
      setLastError(err);
      addLog("Suporte do Navegador", "warn", err.title, err.message);
      setIsSubscribing(false);
      return null;
    }

    // 4. Request Permission IMMEDIATELY to preserve User Gesture Token
    addLog("Permissão", "info", "Solicitando permissão no navegador...");
    let currentPerm: NotificationPermission = "default";
    try {
      currentPerm = await requestNotificationPermissionDirect();
    } catch (permErr: any) {
      console.warn("[usePushNotifications] Erro ao solicitar permissão:", permErr);
    }
    setPermission(currentPerm);

    if (currentPerm !== "granted") {
      const err: NotificationError = {
        type: "PERMISSION_DENIED",
        title: "Permissão de Notificação Bloqueada",
        message: currentPerm === "denied"
          ? "As notificações estão bloqueadas nas permissões do site neste navegador."
          : "A permissão não foi confirmada.",
        resolution: "No topo do navegador (ao lado do link), toque no ícone de opções/cadeado 🔒 ou 'Configurações do site' e altere 'Notificações' para 'Permitir'.",
      };
      setLastError(err);
      addLog("Permissão", "warn", err.title, err.resolution);
      setIsSubscribing(false);
      return null;
    }
    addLog("Permissão", "ok", "Permissão concedida pelo usuário.");

    // Run background diagnostics asynchronously without blocking
    runAndLogNotificationDiagnostics("Push Toggle (Celular/Desktop)").catch(() => {});

    try {
      // 5. Ensure Service Worker is active & ready
      addLog("Service Worker", "info", "Inicializando e ativando Service Worker...");
      let registration: ServiceWorkerRegistration;
      try {
        registration = await ensureActiveServiceWorker();
        addLog("Service Worker", "ok", `Service Worker ativo no escopo: ${registration.scope}`);
      } catch (swErr: any) {
        const err: NotificationError = {
          type: "SW_ERROR",
          title: "Falha no Service Worker",
          message: "Não foi possível carregar o Service Worker no seu celular.",
          resolution: "Recarregue a página e tente novamente.",
          raw: swErr,
        };
        setLastError(err);
        addLog("Service Worker", "warn", err.title, swErr?.message);
        return null;
      }

      // 6. Check existing push subscription or create new
      let pushSub: PushSubscription | null = null;
      if (registration.pushManager) {
        try {
          pushSub = await registration.pushManager.getSubscription();
        } catch (e) {
          console.warn("[usePushNotifications] Falha ao verificar subscrição ativa:", e);
        }
      }

      if (!pushSub) {
        // Fetch VAPID Public Key with safe JSON parsing & fallback
        addLog("Chave VAPID", "info", "Obtendo chave de inscrição...");
        const vapidRes = await getVapidPublicKeySafe();
        const publicKey = vapidRes.key;

        addLog("Inscrição Push", "info", "Criando subscrição no PushManager do aparelho...");
        const convertedKey = urlBase64ToUint8Array(publicKey);
        pushSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
        addLog("Inscrição Push", "ok", "Subscrição gerada com sucesso pelo aparelho.");
      } else {
        addLog("Inscrição Push", "ok", "Subscrição já existente e ativa no aparelho.");
      }

      // 7. Store in Firestore
      addLog("Persistência", "info", "Sincronizando com o banco de dados...");
      try {
        const subJson = pushSub.toJSON();
        const userId =
          auth.currentUser?.uid ||
          localStorage.getItem("davveroId_student_identity") ||
          "anon_" + Date.now();
        const subId = btoa(pushSub.endpoint).replace(/[^a-zA-Z0-9]/g, "").substring(0, 40);

        const record = {
          id: subId,
          endpoint: pushSub.endpoint,
          keys: subJson.keys || {},
          subscription: subJson,
          userId,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          isMobile: env.isMobile,
          deviceType: env.isIOS ? "iOS" : env.isAndroid ? "Android" : "Desktop",
          active: true,
          updatedAt: new Date().toISOString(),
        };

        // Save in push_subscriptions
        await setDoc(doc(db, "push_subscriptions", subId), record, { merge: true });
        // Also sync in fcm_tokens for backward compatibility
        await setDoc(
          doc(db, "fcm_tokens", subId),
          {
            token: pushSub.endpoint,
            subscription: subJson,
            userId,
            isMobile: env.isMobile,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        addLog("Persistência", "ok", "Aparelho vinculado ao sistema com sucesso.");
      } catch (dbErr: any) {
        console.warn("[usePushNotifications] Erro ao salvar subscrição no Firestore (Push local ativo):", dbErr);
        addLog("Persistência", "warn", "Push ativo no celular, sincronização secundária pendente.", dbErr?.message);
      }

      setSubscription(pushSub);
      localStorage.setItem("davvero_push_subscribed", "true");
      addLog("Concluído", "ok", "Notificações ativadas com sucesso!");
      return pushSub;
    } catch (unexpectedErr: any) {
      console.warn("[usePushNotifications] Erro inesperado na subscrição:", unexpectedErr);
      const err: NotificationError = {
        type: "UNKNOWN",
        title: "Falha na Inscrição",
        message: unexpectedErr?.message || "Ocorreu um erro ao ativar notificações no celular.",
        resolution: "Verifique se o aplicativo possui permissão de notificações nas configurações do seu celular.",
        raw: unexpectedErr,
      };
      setLastError(err);
      addLog("Falha", "warn", err.title, unexpectedErr?.message);
      return null;
    } finally {
      setIsSubscribing(false);
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    setIsSubscribing(true);
    try {
      if (subscription) {
        await subscription.unsubscribe();
        const subId = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, "").substring(0, 40);
        try {
          await deleteDoc(doc(db, "push_subscriptions", subId));
          await deleteDoc(doc(db, "fcm_tokens", subId));
        } catch (e) {
          console.warn("Erro ao remover subscrição do Firestore:", e);
        }
      }
      setSubscription(null);
      localStorage.removeItem("davvero_push_subscribed");
      setLastError(null);
      return true;
    } catch (err) {
      console.warn("[usePushNotifications] Erro ao desinscrever:", err);
      return false;
    } finally {
      setIsSubscribing(false);
    }
  };

  // Run full system diagnostic
  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticLogs([]);
    setLastError(null);

    const report = await runAndLogNotificationDiagnostics("Painel de Diagnóstico Manual");

    addLog("Diagnóstico", "info", "Iniciando diagnóstico do sistema de notificações...");

    if (report.environment.isInIframe) {
      addLog("Ambiente", "info", "Aplicação sendo executada em visualização de frame embutido.");
    }
    if (report.environment.isIOS && !report.environment.isStandalone) {
      addLog("Ambiente iOS", "warn", "No Safari iOS, instale o PWA na Tela de Início para Push.");
    }

    // 1. Online status
    if (navigator.onLine) {
      addLog("Conexão de Rede", "ok", "Dispositivo conectado à internet.");
    } else {
      addLog("Conexão de Rede", "warn", "Dispositivo offline ou sem conexão ativa.");
    }

    // 2. Notification API
    if (report.permissions.notificationSupported) {
      if (report.permissions.isGranted) {
        addLog("API Notificação", "ok", `API Notification disponível (Permissão concedida: 'granted')`);
      } else {
        addLog("API Notificação", "info", `API Notification disponível (Permissão atual: '${report.permissions.state}')`);
      }
    } else {
      addLog("API Notificação", "warn", "API Notification não suportada pelo navegador.");
    }

    // 3. Service Worker
    if (report.serviceWorker.swSupported) {
      if (report.serviceWorker.hasActiveRegistration) {
        addLog("Service Worker", "ok", `Service Worker ativo no escopo: ${report.serviceWorker.registrationScope}`);
      } else {
        addLog("Service Worker", "info", "Service Worker pronto para registro.");
      }
    } else {
      addLog("Service Worker", "warn", "Service Worker não suportado.");
    }

    // 4. Server VAPID Status
    if (report.vapid.isValidFormat) {
      addLog("Chave VAPID", "ok", `Chave VAPID válida (${report.vapid.publicKeyPreview}) - Origem: ${report.vapid.keySource}`);
    } else {
      addLog("Chave VAPID", "warn", `Chave VAPID com problemas: ${report.vapid.error}`);
    }

    // 5. Existing Subscription
    if (report.subscription.isSubscribed) {
      addLog("Subscrição Atual", "ok", `Dispositivo inscrito: ${report.subscription.endpointPreview}`);
      if (report.subscription.rawSubscription) {
        setSubscription(report.subscription.rawSubscription);
      }
    } else {
      addLog("Subscrição Atual", "info", "Nenhuma subscrição ativa encontrada no momento.");
    }

    addLog("Diagnóstico", "ok", "Diagnóstico finalizado.");
    setIsDiagnosing(false);
  };

  // Test local visual notification
  const sendLocalTestNotification = async (): Promise<boolean> => {
    try {
      if (!("Notification" in window)) {
        alert("Notificações não são suportadas neste navegador.");
        return false;
      }

      if (Notification.permission !== "granted") {
        const perm = await requestNotificationPermissionDirect();
        if (perm !== "granted") {
          alert("Permissão para notificações não foi concedida.");
          return false;
        }
      }

      const reg = await ensureActiveServiceWorker();
      await reg.showNotification("DAVVERO System", {
        body: "🔔 Teste de Notificação Local recebido com sucesso!",
        icon: "/logo192.png",
        badge: "/logo192.png",
      });
      return true;
    } catch (e: any) {
      console.warn("[usePushNotifications] Erro ao disparar notificação local:", e);
      alert("Aviso: " + e.message);
      return false;
    }
  };

  // Test server push send
  const sendServerTestPush = async (): Promise<boolean> => {
    try {
      if (!subscription) {
        alert("Ative as notificações primeiro antes de testar o envio pelo servidor.");
        return false;
      }

      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          subscription,
          title: "Teste de Push Server - DAVVERO",
          message: "✅ Esta notificação foi enviada pelo servidor backend via protocolo WebPush!",
          url: "/",
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const rawText = await res.text();
        console.warn("[usePushNotifications] Servidor retornou conteúdo não-JSON:", res.status, rawText.substring(0, 100));
        throw new Error(`O servidor retornou uma resposta não-JSON (HTTP ${res.status}). O serviço backend pode estar reiniciando.`);
      }

      const data = await res.json();
      if (res.ok && data.success) {
        return true;
      } else {
        throw new Error(data.error || data.details || `Falha no servidor (HTTP ${res.status})`);
      }
    } catch (e: any) {
      console.warn("[usePushNotifications] Erro no teste do servidor:", e);
      alert(`Aviso no teste: ${e.message}`);
      return false;
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    isSubscribing,
    isDiagnosing,
    lastError,
    diagnosticLogs,
    mobileEnv,
    subscribe,
    unsubscribe,
    runDiagnostics,
    sendLocalTestNotification,
    sendServerTestPush,
  };
}
