import { useState, useEffect, useCallback } from "react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

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

// Utility to convert VAPID base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  try {
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
  } catch (err) {
    console.warn("[usePushNotifications] Erro ao converter VAPID key:", err);
    throw new Error("Formato da chave VAPID pública inválido");
  }
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
          const reg = await navigator.serviceWorker.ready;
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub) {
            setSubscription(existingSub);
            localStorage.setItem("davvero_push_subscribed", "true");
          }
        } catch (e) {
          console.warn("[usePushNotifications] Erro ao verificar subscrição existente:", e);
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
        console.warn("[usePushNotifications] Erro ao solicitar permissão (possível restrição de iframe):", permErr);
      }
      setPermission(currentPerm);

      if (currentPerm !== "granted") {
        const err: NotificationError = {
          type: isInIframe ? "IFRAME_RESTRICTION" : "PERMISSION_DENIED",
          title: isInIframe ? "Permissão em visualização de frame" : "Permissão não concedida",
          message: isInIframe
            ? "O navegador pode bloquear solicitações de notificação embutidas em iframes de pré-visualização."
            : `O status da permissão está como '${currentPerm}'.`,
          resolution: isInIframe
            ? "Abra a aplicação em uma nova aba para permitir e testar as notificações nativas."
            : "Clique no ícone de cadeado na barra de endereços do navegador e altere 'Notificações' para 'Permitir'.",
        };
        setLastError(err);
        addLog("Permissão", "warn", err.title, err.resolution);
        return null;
      }
      addLog("Permissão", "ok", "Permissão concedida pelo usuário.");

      // Check Service Worker
      addLog("Service Worker", "info", "Aguardando Service Worker ativo...");
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.ready;
        addLog("Service Worker", "ok", "Service Worker pronto e ativo.");
      } catch (swErr: any) {
        const err: NotificationError = {
          type: "SW_ERROR",
          title: "Falha no Service Worker",
          message: "Não foi possível registrar ou inicializar o Service Worker.",
          resolution: "Atualize a página e aguarde o carregamento completo do aplicativo.",
          raw: swErr,
        };
        setLastError(err);
        addLog("Service Worker", "warn", err.title, swErr?.message);
        return null;
      }

      // Fetch VAPID Public Key from server
      addLog("Chave VAPID", "info", "Obtendo chave pública VAPID do servidor (/api/push/public-key)...");
      let publicKey = "";
      try {
        const res = await fetch("/api/push/public-key", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Servidor respondeu com status HTTP ${res.status}`);
        }
        const data = await res.json();
        publicKey = data.publicKey;
        if (!publicKey || typeof publicKey !== "string" || publicKey.trim().length === 0) {
          throw new Error("Chave VAPID pública retornada vazia");
        }
        addLog("Chave VAPID", "ok", `Chave VAPID válida recebida (${publicKey.substring(0, 10)}...)`);
      } catch (netErr: any) {
        const isNetwork = !navigator.onLine || netErr?.message?.includes("Failed to fetch") || netErr?.message?.includes("NetworkError");
        const err: NotificationError = {
          type: isNetwork ? "NETWORK_ERROR" : "VAPID_CONFIG_ERROR",
          title: isNetwork ? "Erro de conexão com o servidor" : "Falha na chave VAPID",
          message: isNetwork
            ? "Não foi possível contatar o servidor para obter a credencial de mensageria."
            : `Erro ao obter VAPID: ${netErr.message}`,
          resolution: isNetwork
            ? "Verifique sua conexão com a internet e tente novamente."
            : "Verifique as variáveis de ambiente VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no servidor.",
          raw: netErr,
        };
        setLastError(err);
        addLog("Chave VAPID", "warn", err.title, err.message);
        return null;
      }

      // Convert VAPID and Subscribe via PushManager
      addLog("Inscrição Push", "info", "Criando subscrição de mensageria no PushManager do navegador...");
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
          message: subErr?.message || "O navegador recusou a inscrição com a chave VAPID fornecida.",
          resolution: "Tente recarregar a página ou abrir o aplicativo diretamente em uma nova aba.",
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
    }
  };

  // Run full system diagnostic
  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticLogs([]);
    setLastError(null);

    addLog("Diagnóstico", "info", "Iniciando diagnóstico completo do sistema de notificações...");

    const isInIframe = typeof window !== "undefined" && window.self !== window.top;
    if (isInIframe) {
      addLog("Ambiente", "info", "Aplicação sendo executada em visualização de frame embutido.");
    }

    // 1. Online status
    if (navigator.onLine) {
      addLog("Conexão de Rede", "ok", "Dispositivo conectado à internet.");
    } else {
      addLog("Conexão de Rede", "warn", "Dispositivo offline ou sem conexão ativa.");
    }

    // 2. Notification API
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = Notification.permission;
      if (perm === "granted") {
        addLog("API Notificação", "ok", `API Notification disponível (Permissão concedida: 'granted')`);
      } else {
        addLog("API Notificação", "info", `API Notification disponível (Permissão atual: '${perm}')`);
      }
    } else {
      addLog("API Notificação", "warn", "API Notification não suportada pelo navegador.");
    }

    // 3. Service Worker
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        addLog("Service Worker", "ok", `Service Worker ativo no escopo: ${reg.scope}`);
      } catch (swE: any) {
        addLog("Service Worker", "warn", "Service Worker aguardando ativação ou registro", swE?.message);
      }
    } else {
      addLog("Service Worker", "warn", "Service Worker não suportado.");
    }

    // 4. Server VAPID Status
    try {
      const res = await fetch("/api/push/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.vapidConfigured) {
          addLog("Servidor VAPID", "ok", `Chave VAPID configurada no servidor (${data.publicKeyPreview})`);
        } else {
          addLog("Servidor VAPID", "warn", "VAPID não configurado no servidor (.env ausente).");
        }
      } else {
        addLog("Servidor VAPID", "warn", `Servidor respondeu HTTP ${res.status} ao consultar status VAPID.`);
      }
    } catch (vapidErr: any) {
      addLog("Servidor VAPID", "warn", "Falha de conexão com endpoint /api/push/status", vapidErr?.message);
    }

    // 5. Existing Subscription
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const currentSub = await reg.pushManager.getSubscription();
        if (currentSub) {
          addLog("Subscrição Atual", "ok", `Dispositivo inscrito: ${currentSub.endpoint.substring(0, 35)}...`);
          setSubscription(currentSub);
        } else {
          addLog("Subscrição Atual", "info", "Nenhuma subscrição ativa encontrada no momento.");
        }
      }
    } catch (subErr: any) {
      addLog("Subscrição Atual", "info", "Nenhuma subscrição ativa encontrada.", subErr?.message);
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
        const reg = await navigator.serviceWorker.ready;
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
