import { APP_VERSION, APP_BUILD } from "./constants";

export const CURRENT_SHELL_CACHE = `app-shell-cache-v${APP_VERSION}`;
export const CURRENT_STATIC_CACHE = `static-assets-cache-v${APP_VERSION}`;

const STORAGE_KEYS = {
  ATTEMPT_COUNT: "davvero_version_reload_count",
  LAST_TIMESTAMP: "davvero_version_last_attempt_ts",
  TARGET_VERSION: "davvero_version_target",
};

export interface VersionCheckResult {
  isObsolete: boolean;
  serverVersion: string;
  localVersion: string;
  isLoopBlocked: boolean;
  status: "up_to_date" | "auto_updating" | "loop_prevented" | "offline_or_error";
}

let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 10000; // 10 seconds cooldown between routine network checks

/**
 * Parses a version string into structured numeric and suffix parts for accurate comparison.
 * Examples: "8.6b", "8.5", "5.3.0", "v8.10a"
 */
export function parseVersion(v: string): { major: number; minor: number; patch: number; suffix: string } {
  if (!v || typeof v !== "string") return { major: 0, minor: 0, patch: 0, suffix: "" };
  const clean = v.trim().toLowerCase().replace(/^v/, "");
  
  // Format like 8.6b or 5.3.0b
  const match = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?([a-z].*)?$/);
  if (match) {
    return {
      major: parseInt(match[1] || "0", 10),
      minor: parseInt(match[2] || "0", 10),
      patch: parseInt(match[3] || "0", 10),
      suffix: match[4] || "",
    };
  }

  // Fallback if non-standard
  const nums = clean.match(/\d+/g);
  return {
    major: nums && nums[0] ? parseInt(nums[0], 10) : 0,
    minor: nums && nums[1] ? parseInt(nums[1], 10) : 0,
    patch: nums && nums[2] ? parseInt(nums[2], 10) : 0,
    suffix: "",
  };
}

/**
 * Compares two versions:
 * Returns:
 *  < 0 if v1 < v2 (v2 is newer)
 *  0 if v1 === v2
 *  > 0 if v1 > v2 (v1 is newer)
 */
export function compareVersions(v1: string, v2: string): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;
  if (v1.trim().toLowerCase() === v2.trim().toLowerCase()) return 0;

  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (p1.major !== p2.major) return p1.major - p2.major;
  if (p1.minor !== p2.minor) return p1.minor - p2.minor;
  if (p1.patch !== p2.patch) return p1.patch - p2.patch;
  if (p1.suffix !== p2.suffix) {
    return p1.suffix.localeCompare(p2.suffix);
  }
  return 0;
}

/**
 * Normalizes and compares versions strictly.
 * Returns true ONLY if the server version is strictly newer than the local version.
 * If local is equal to or newer than server, returns false to prevent false updates and loops.
 */
export function isVersionOutdated(local: string, server: string): boolean {
  if (!server || !local) return false;
  return compareVersions(local, server) < 0;
}

/**
 * Deeply purges browser cache storage safely without breaking in-flight modules
 * or corrupting user application state.
 */
export async function clearAppCaches(forcePurgeAll = false): Promise<void> {
  // Se estiver offline, NUNCA limpar caches do PWA para preservar o funcionamento offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.log("[VersionManager] Offline detectado; limpeza de caches suprimida para preservar modo offline.");
    return;
  }

  try {
    // 1. Clear dynamic CacheStorage (purges all caches when forcePurgeAll is true, or removes non-matching versions)
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (forcePurgeAll) {
            return caches.delete(key);
          }
          // Purgar caches legados e quaisquer instâncias de app-shell que não correspondam à versão corrente
          if (
            key === "app-shell-cache" ||
            key === "firestore-data-cache" ||
            (key.startsWith("app-shell-cache-") && key !== CURRENT_SHELL_CACHE) ||
            (key.startsWith("static-assets-cache") && key !== CURRENT_STATIC_CACHE) ||
            key.includes("v6.9") ||
            key.includes("6.9b")
          ) {
            return caches.delete(key);
          }
          if (!key.includes("workbox-precache") && !key.includes(CURRENT_SHELL_CACHE) && !key.includes(CURRENT_STATIC_CACHE)) {
            return caches.delete(key);
          }
          return Promise.resolve(true);
        })
      );
      console.log("[VersionManager] Caches verificados e sincronizados com sucesso. forcePurgeAll =", forcePurgeAll);
    }

    // 2. Notify active service workers to update and activate immediately
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          if (forcePurgeAll) {
            reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            reg.active?.postMessage({ type: "PURGE_ALL_CACHES" });
            await reg.unregister();
          } else {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            }
            await reg.update().catch(() => {});
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn("[VersionManager] Aviso ao sincronizar caches:", err);
  }
}

/**
 * Executada proativamente no ciclo de inicialização do app para eliminar caches legados órfãos
 * (incluindo fantasmas da v6.9b ou app-shell não versionado).
 */
export async function purgeLegacyVersionCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const keys = await caches.keys();
    const obsoleteKeys = keys.filter(
      (k) =>
        k === "app-shell-cache" ||
        k === "firestore-data-cache" ||
        (k.startsWith("app-shell-cache-") && k !== CURRENT_SHELL_CACHE) ||
        (k.startsWith("static-assets-cache") && k !== CURRENT_STATIC_CACHE) ||
        k.includes("v6.9") ||
        k.includes("6.9b") ||
        k.includes("v7.") ||
        k.includes("v8.0") ||
        k.includes("v8.1") ||
        k.includes("v8.2") ||
        k.includes("v8.3") ||
        k.includes("v8.4") ||
        k.includes("v8.5") ||
        k.includes("v8.6") ||
        k.includes("v8.7") ||
        k.includes("v8.8")
    );
    if (obsoleteKeys.length > 0) {
      console.log(`[VersionManager] Purgando ${obsoleteKeys.length} caches legados:`, obsoleteKeys);
      await Promise.all(obsoleteKeys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn("[VersionManager] Erro não fatal ao purgar caches legados:", err);
  }
}

/**
 * Safely reloads the application with clean URL params and cache-busting timestamp
 */
export async function safeReloadApp(targetVersion?: string, forcePurgeAll = false): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn("[VersionManager] Tentativa de reload com rede offline cancelada.");
    return;
  }

  // Prevenir quebra de container e tela branca dentro de iframes (ex: preview do AI Studio)
  if (typeof window !== "undefined") {
    try {
      if (window.self !== window.top) {
        console.warn("[VersionManager] Ambiente em iframe detectado; reload automático suprimido para proteger a prévia.");
        return;
      }
    } catch (_) {
      return;
    }
  }

  const finalVersion = targetVersion || APP_VERSION;
  try {
    localStorage.setItem("app_version", finalVersion);
    localStorage.setItem("last_seen_app_version", finalVersion);
  } catch {}

  await clearAppCaches(forcePurgeAll);
  
  try {
    sessionStorage.removeItem(STORAGE_KEYS.ATTEMPT_COUNT);
    sessionStorage.removeItem(STORAGE_KEYS.LAST_TIMESTAMP);
    sessionStorage.removeItem(STORAGE_KEYS.TARGET_VERSION);
    if (forcePurgeAll) {
      sessionStorage.setItem("davvero_gate_dismissed", "true");
    }
  } catch {}

  // Use timestamp query param to force browser HTTP disk cache bypass
  const baseCleanUrl = window.location.origin + window.location.pathname;
  const reloadUrl = `${baseCleanUrl}?_upd=${Date.now()}`;
  
  // Replace location so the outdated page is not stored in session history
  window.location.replace(reloadUrl);
}

/**
 * Checks the server version using multiple fallback endpoints (static version.json, API, and known Firestore version)
 * with robust loop detection and anti-spam circuit breaker.
 * Guarantees the application will never enter an infinite reload loop.
 */
export async function checkServerVersionWithAntiLoop(
  force = false,
  knownServerVersion?: string
): Promise<VersionCheckResult> {
  // Se estiver offline ou rodando em iframe, suprime obsolescência para garantir estabilidade e evitar tela branca
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      isObsolete: false,
      serverVersion: APP_VERSION,
      localVersion: APP_VERSION,
      isLoopBlocked: false,
      status: "up_to_date",
    };
  }

  if (typeof window !== "undefined") {
    try {
      if (window.self !== window.top) {
        return {
          isObsolete: false,
          serverVersion: APP_VERSION,
          localVersion: APP_VERSION,
          isLoopBlocked: false,
          status: "up_to_date",
        };
      }
    } catch (_) {}
  }

  const now = Date.now();
  if (!force && now - lastCheckTime < CHECK_COOLDOWN_MS) {
    return {
      isObsolete: false,
      serverVersion: APP_VERSION,
      localVersion: APP_VERSION,
      isLoopBlocked: false,
      status: "up_to_date",
    };
  }
  lastCheckTime = now;

  let candidateVersion: string | null = null;
  let candidateBuild: string | null = null;

  // 1. Try static /version.json (works on static hosts like Netlify, GitHub Pages, Vite dev, and production)
  try {
    const res = await fetch(`/version.json?t=${now}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && typeof data === "object") {
        if (data.version && typeof data.version === "string") {
          candidateVersion = data.version;
        }
        if (data.build && typeof data.build === "string") {
          candidateBuild = data.build;
        }
      }
    }
  } catch (err) {
    // Silently proceed to fallbacks
  }

  // 2. Fallback to /api/version if version.json was not accessible
  if (!candidateVersion) {
    try {
      const res = await fetch(`/api/version?t=${now}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data === "object") {
          if (data.version && typeof data.version === "string") {
            candidateVersion = data.version;
          }
          if (data.build && typeof data.build === "string") {
            candidateBuild = data.build;
          }
        }
      }
    } catch (err) {
      // Silently proceed
    }
  }

  // 3. Fallback to known server version (e.g. from Firestore real-time settings document)
  if (!candidateVersion && knownServerVersion && typeof knownServerVersion === "string") {
    candidateVersion = knownServerVersion;
  } else if (
    candidateVersion &&
    knownServerVersion &&
    compareVersions(candidateVersion, knownServerVersion) < 0
  ) {
    // If Firestore has an even newer version, prefer the higher one
    candidateVersion = knownServerVersion;
  }

  // Verificar se o usuário já dispensou a mensagem nesta sessão ou solicitou bypass
  if (
    typeof sessionStorage !== "undefined" &&
    (sessionStorage.getItem("davvero_gate_dismissed") === "true" ||
      sessionStorage.getItem("davvero_bypass_update") === "true")
  ) {
    return {
      isObsolete: false,
      serverVersion: APP_VERSION,
      localVersion: APP_VERSION,
      isLoopBlocked: false,
      status: "up_to_date",
    };
  }

  const serverVersion = candidateVersion || APP_VERSION;
  // A versão só é considerada obsoleta se a versão remota for estritamente mais recente (ex: 8.9 > 8.8)
  // Diferenças de data de build NUNCA causam obsolescência ou bloqueio de tela
  const isObsolete = isVersionOutdated(APP_VERSION, serverVersion);

  if (!isObsolete) {
    // Running latest version! Clean any previous session loop flags
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ATTEMPT_COUNT);
      sessionStorage.removeItem(STORAGE_KEYS.LAST_TIMESTAMP);
      sessionStorage.removeItem(STORAGE_KEYS.TARGET_VERSION);
    } catch {}

    return {
      isObsolete: false,
      serverVersion,
      localVersion: APP_VERSION,
      isLoopBlocked: false,
      status: "up_to_date",
    };
  }

  // Version mismatch detected! Check circuit breaker to prevent infinite reload loops
  let attemptCount = 0;
  let lastAttemptTs = 0;
  let storedTarget = "";

  try {
    attemptCount = parseInt(sessionStorage.getItem(STORAGE_KEYS.ATTEMPT_COUNT) || "0", 10);
    lastAttemptTs = parseInt(sessionStorage.getItem(STORAGE_KEYS.LAST_TIMESTAMP) || "0", 10);
    storedTarget = sessionStorage.getItem(STORAGE_KEYS.TARGET_VERSION) || "";
  } catch {}

  const timeSinceLastAttempt = now - lastAttemptTs;
  const isSameTarget = storedTarget === serverVersion;

  // Circuit Breaker Rule: Se já foi tentada uma recarga automática nos últimos 60 segundos para este alvo,
  // NÃO entrar em loop infinito e NÃO bloquear o usuário de utilizar a aplicação.
  if (isSameTarget && attemptCount >= 1 && timeSinceLastAttempt < 60000) {
    console.warn(
      `[VersionManager] Loop evitado: Versão ${serverVersion} detectada mas auto-reload já tentado há ${Math.round(
        timeSinceLastAttempt / 1000
      )}s. Permitindo uso contínuo sem looping.`
    );
    return {
      isObsolete: false,
      serverVersion,
      localVersion: APP_VERSION,
      isLoopBlocked: false,
      status: "loop_prevented",
    };
  }

  // Record this attempt before proceeding
  try {
    sessionStorage.setItem(STORAGE_KEYS.ATTEMPT_COUNT, String(attemptCount + 1));
    sessionStorage.setItem(STORAGE_KEYS.LAST_TIMESTAMP, String(now));
    sessionStorage.setItem(STORAGE_KEYS.TARGET_VERSION, serverVersion);
  } catch {}

  return {
    isObsolete: true,
    serverVersion,
    localVersion: APP_VERSION,
    isLoopBlocked: false,
    status: "auto_updating",
  };
}
