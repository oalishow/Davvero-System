import { useState, useEffect, useCallback } from "react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import {
  runAndLogNotificationDiagnostics,
  getVapidPublicKeySafe,
  urlBase64ToUint8Array,
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
  type: "NETWORK_ERROR" | "PERMISSION_DENIED" | "VAPID_CONFIG_ERROR" | "UNSUPPORTED_BROWSER" | "SW_ERROR" | "IFRAME_RESTRICTION" | "UNKNOWN";
  title: string;
  message: string;
  resolution: string;
  raw?: any;
}

// Helper to obtain or register an active ServiceWorker with timeout guard
async function getOrRegisterSW(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service Worker não é suportado neste navegador.");
  }

  // 1. Check existing registration
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing && existing.active) {
      return existing;
    }
  } catch (e) {
    console.warn("[usePushNotifications] Erro ao buscar registration existente:", e);
  }

  // 2. Try registering firebase-messaging-sw or standard sw
  try {
    await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  } catch (regErr) {
    console.warn("[usePushNotifications] Registro de fallback sw:", regErr);
  }

  // 3. Await ready with timeout to avoid hanging indefinitely
  const readyPromise = navigator.serviceWorker.ready;
  const timeoutPromise = new Promise<ServiceWorkerRegistration>((_, reject) =>
    setTimeout(() => reject(new Error("Tempo limite ao inicializar o Service Worker.")), 5000)
  );

  return await Promise.race([readyPromise, timeoutPromise]);
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [lastError, setLastError] = useState<NotificationError | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);

  const addLog = useCallback((step: string, status: "ok" | "error" | "warn" | "info" | "running", message: string, detail?: string) => {
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
  }, []);

  // Check initial browser capabilities and existing subscription
  useEffect(() => {
    const checkSupport = async () => {
      const hasNotification = typeof window !== "undefined" && "Notification" in window;
      const hasSW = typeof navigator !== "undefined" && "serviceWorker" in navigator;
      const hasPushManager = typeof window !== "undefined" && "PushManager" in window;

      const supported = hasNotification && hasSW && hasPushManager;
      setIsSupported(supported);

      if (hasNotification) {
        setPermission(Notification.permission);
      }

      if (supported) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
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

  // Main subscription method
  const subscribe = async (): Promise<PushSubscription | null> => {
    setIsSubscribing(true);
    setLastError(null);
    setDiagnosticLogs([]);

    // Execute full structured console diagnostics
    await runAndLogNotificationDiagnostics("Push Toggle (Ativar Notificações)");

    try {
      addLog("Suporte do Navegador", "info", "Verificando APIs de Notificação e Service Worker...");

      const isInIframe = typeof window !== "undefined" && window.self !== window.top;

      if (typeof window === "undefined" || !("Notification" in window)) {
        const err: NotificationError = {
          type: "UNSUPPORTED_BROWSER",
          title: "Navegador incompatível",
          message: "Este navegador ou ambiente não suporta a API de Notificações nativas.",
          resolution: "Abra a aplicação no Google Chrome, Edge, Safari ou instale o aplicativo como PWA na tela inicial.",
        };
        setLastError(err);
        addLog("Suporte do Navegador", "warn", err.title, err.message);
        return null;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const err: NotificationError = {
          type: "UNSUPPORTED_BROWSER",
          title: "PushManager indisponível",
          message: "O gerenciador de push do navegador não está disponível neste modo.",
          resolution: "Certifique-se de acessar via HTTPS ou abrir o link direto do app em uma nova aba.",
        };
        setLastError(err);
        addLog("Suporte do Navegador", "warn", err.title, err.message);
        return null;
      }

      addLog("Suporte do Navegador", "ok", "APIs de Notificação e Service Worker suportadas.");

      // Request Permission
      addLog("Permissão", "info", "Solicitando permissão de notificação ao usuário...");
      let currentPerm: NotificationPermission = "default";
      try {
        currentPerm = await Notification.requestPermission();
      } catch (permErr: any) {
        console.warn("[usePushNotifications] Erro ao solicitar permissão:", permErr);
      }
      setPermission(currentPerm);

      if (currentPerm !== "granted") {
        const err: NotificationError = {
          type: isInIframe ? "IFRAME_RESTRICTION" : "PERMISSION_DENIED",
          title: isInIframe ? "Permissão em visualização de frame" : "Permissão não concedida",
          message: isInIframe
            ? "O navegador bloqueia solicitações de notificação embutidas em iframes de pré-visualização."
            : `O status da permissão está como '${currentPerm}'.`,
          resolution: isInIframe
            ? "Abra a aplicação em uma nova aba do navegador para permitir e ativar as notificações."
            : "Clique no ícone de cadeado na barra de endereços do navegador e altere 'Notificações' para 'Permitir'.",
        };
        setLastError(err);
        addLog("Permissão", "warn", err.title, err.resolution);
        return null;
      }
      addLog("Permissão", "ok", "Permissão concedida pelo usuário.");

      // Check / Register Service Worker
      addLog("Service Worker", "info", "Inicializando Service Worker...");
      let registration: ServiceWorkerRegistration;
      try {
        registration = await getOrRegisterSW();
        addLog("Service Worker", "ok", "Service Worker pronto e ativo.");
      } catch (swErr: any) {
        const err: NotificationError = {
          type: "SW_ERROR",
          title: "Falha no Service Worker",
          message: "Não foi possível inicializar o Service Worker.",
          resolution: "Atualize a página e aguarde o carregamento completo do aplicativo.",
          raw: swErr,
        };
        setLastError(err);
        addLog("Service Worker", "warn", err.title, swErr?.message);
        return null;
      }

      // Fetch VAPID Public Key with safe JSON parsing & fallback
      addLog("Chave VAPID", "info", "Obtendo e validando credencial pública VAPID...");
      const vapidRes = await getVapidPublicKeySafe();
      const publicKey = vapidRes.key;

      if (vapidRes.source === "fallback") {
        addLog("Chave VAPID", "info", `Utilizando chave VAPID institucional (${publicKey.substring(0, 10)}...)`, vapidRes.error);
      } else {
        addLog("Chave VAPID", "ok", `Chave VAPID recebida do servidor (${publicKey.substring(0, 10)}...)`);
      }

      // Convert VAPID and Subscribe via PushManager
      addLog("Inscrição Push", "info", "Criando subscrição no PushManager do navegador...");
      let newSubscription: PushSubscription;
      try {
        const convertedKey = urlBase64ToUint8Array(publicKey);
        newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
        addLog("Inscrição Push", "ok", "Subscrição gerada com sucesso pelo PushManager.");
      } catch (subErr: any) {
        const err: NotificationError = {
          type: "UNKNOWN",
          title: "Falha na subscrição push",
          message: subErr?.message || "O navegador recusou a inscrição com a chave fornecida.",
          resolution: "Tente abrir o aplicativo diretamente em uma aba do navegador.",
          raw: subErr,
        };
        setLastError(err);
        addLog("Inscrição Push", "warn", err.title, subErr?.message);
        return null;
      }

      // Store in Firestore
      addLog("Persistência", "info", "Salvando subscrição no banco de dados Firestore...");
      try {
        const subJson = newSubscription.toJSON();
        const userId = auth.currentUser?.uid || localStorage.getItem("davveroId_student_identity") || "anon_" + Date.now();
        const subId = btoa(newSubscription.endpoint).replace(/[^a-zA-Z0-9]/g, "").substring(0, 40);

        const record = {
          id: subId,
          endpoint: newSubscription.endpoint,
          keys: subJson.keys || {},
          subscription: subJson,
          userId,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          active: true,
          updatedAt: new Date().toISOString(),
        };

        // Save in push_subscriptions
        await setDoc(doc(db, "push_subscriptions", subId), record, { merge: true });
        // Also sync in fcm_tokens for backward compatibility
        await setDoc(doc(db, "fcm_tokens", subId), {
          token: newSubscription.endpoint,
          subscription: subJson,
          userId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        addLog("Persistência", "ok", "Subscrição registrada no Firestore com sucesso.");
      } catch (dbErr: any) {
        console.warn("[usePushNotifications] Erro ao salvar subscrição no Firestore (Push local ainda ativo):", dbErr);
        addLog("Persistência", "warn", "Não foi possível salvar no Firestore, mas o push local está ativo.", dbErr?.message);
      }

      setSubscription(newSubscription);
      localStorage.setItem("davvero_push_subscribed", "true");
      addLog("Concluído", "ok", "Notificações Push ativadas com sucesso neste dispositivo!");
      
      // Re-log updated diagnostics
      await runAndLogNotificationDiagnostics("Post-Subscribe Sucesso");
      return newSubscription;
    } catch (unexpectedErr: any) {
      console.warn("[usePushNotifications] Erro inesperado:", unexpectedErr);
      const err: NotificationError = {
        type: "UNKNOWN",
        title: "Erro na ativação",
        message: unexpectedErr?.message || "Ocorreu um erro ao ativar notificações.",
        resolution: "Verifique se o aplicativo está aberto em uma aba própria com HTTPS.",
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
    await runAndLogNotificationDiagnostics("Push Toggle (Desativar Notificações)");
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

    addLog("Diagnóstico", "info", "Iniciando diagnóstico completo do sistema de notificações...");

    if (report.environment.isInIframe) {
      addLog("Ambiente", "info", "Aplicação sendo executada em visualização de frame embutido.");
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
        addLog("Service Worker", "info", "Service Worker pronto para registro sob demanda.");
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
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          alert("Permissão para notificações não foi concedida.");
          return false;
        }
      }

      if ("serviceWorker" in navigator) {
        const reg = await getOrRegisterSW();
        await reg.showNotification("DAVVERO System", {
          body: "🔔 Teste de Notificação Local recebido com sucesso!",
          icon: "/logo192.png",
          badge: "/logo192.png",
        });
        return true;
      } else {
        new Notification("DAVVERO System", {
          body: "🔔 Teste de Notificação Local recebido com sucesso!",
          icon: "/logo192.png",
        });
        return true;
      }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          title: "Teste de Push Server - DAVVERO",
          message: "✅ Esta notificação foi enviada pelo servidor backend via protocolo WebPush!",
          url: "/",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return true;
      } else {
        throw new Error(data.error || data.details || "Falha desconhecida no servidor");
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
    subscribe,
    unsubscribe,
    runDiagnostics,
    sendLocalTestNotification,
    sendServerTestPush,
  };
}
