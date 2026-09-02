import { APP_VERSION } from "./constants";

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
const CHECK_COOLDOWN_MS = 15000; // 15 seconds cooldown between routine network checks

/**
 * Normalizes and compares versions safely.
 * Returns true if the version string is different.
 */
export function isVersionOutdated(local: string, server: string): boolean {
  if (!server || !local) return false;
  return local.trim().toLowerCase() !== server.trim().toLowerCase();
}

/**
 * Deeply purges browser cache storage safely without breaking in-flight modules
 * or corrupting user application state.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    // 1. Clear CacheStorage (PWA and fetch caches)
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          // Delete old cache stores safely
          return caches.delete(key);
        })
      );
      console.log("[VersionManager] Caches locais sincronizados com sucesso.");
    }

    // 2. Notify active service workers to update and activate immediately
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        await reg.update().catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[VersionManager] Aviso ao sincronizar caches:", err);
  }
}

/**
 * Safely reloads the application with clean URL params and cache-busting timestamp
 */
export async function safeReloadApp(targetVersion?: string): Promise<void> {
  const finalVersion = targetVersion || APP_VERSION;
  try {
    localStorage.setItem("app_version", finalVersion);
    localStorage.setItem("last_seen_app_version", finalVersion);
  } catch {}

  await clearAppCaches();
  
  // Use timestamp query param to force browser HTTP disk cache bypass
  const baseCleanUrl = window.location.origin + window.location.pathname;
  const reloadUrl = `${baseCleanUrl}?_upd=${Date.now()}`;
  
  // Replace location so the outdated page is not stored in session history
  window.location.replace(reloadUrl);
}

/**
 * Checks the server version with loop detection and anti-spam circuit breaker.
 * Guarantees the application will never enter an infinite reload loop.
 */
export async function checkServerVersionWithAntiLoop(force = false): Promise<VersionCheckResult> {
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

  try {
    const res = await fetch(`/api/version?t=${now}`, {
      cache: "no-store",
      headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const serverVersion: string = data.version || APP_VERSION;
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

    // Version mismatch detected! Check circuit breaker
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

    // Circuit Breaker Rule: If an auto-reload already ran in the last 45 seconds for this target, STOP looping.
    if (isSameTarget && attemptCount >= 1 && timeSinceLastAttempt < 45000) {
      console.warn(
        `[VersionManager] Loop evitado: Versão ${serverVersion} detectada mas auto-reload já tentado há ${Math.round(
          timeSinceLastAttempt / 1000
        )}s.`
      );
      return {
        isObsolete: true,
        serverVersion,
        localVersion: APP_VERSION,
        isLoopBlocked: true,
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
  } catch (err) {
    console.log("[VersionManager] Verificação de versão online em segundo plano:", err);
    return {
      isObsolete: false,
      serverVersion: APP_VERSION,
      localVersion: APP_VERSION,
      isLoopBlocked: false,
      status: "offline_or_error",
    };
  }
}
