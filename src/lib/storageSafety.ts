/**
 * Global Storage Safety & Quota Healing Layer
 * 
 * Protects window.localStorage and window.sessionStorage against browser QuotaExceededError.
 * Automatically evicts oversized offline caches, orphaned Firestore multi-tab clients,
 * and bulky assets to guarantee that the application and Firestore never crash
 * due to storage exhaustion.
 */

export function purgeBulkyStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    const keysToRemove: string[] = [];
    const len = window.localStorage.length;

    for (let i = 0; i < len; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;

      // 1. Orphaned or legacy Firestore client tokens (accumulated from iframes / reloads)
      if (
        k.startsWith("firestore_clients_") ||
        k.startsWith("firestore_targets_") ||
        k.startsWith("firestore_mutations_")
      ) {
        keysToRemove.push(k);
        continue;
      }

      // 2. Bulky offline collection dumps that should not live in 5MB localStorage
      if (
        k === "davveroId_offline_members" ||
        k === "davveroId_offline_events" ||
        k === "davveroId_offline_attendances" ||
        k.startsWith("notif_cache_") ||
        k.startsWith("temp_")
      ) {
        keysToRemove.push(k);
        continue;
      }

      // 3. Bulky base64 images or signatures (>35KB) in localStorage
      if (
        k.includes("logo") ||
        k.includes("signature") ||
        k.includes("image") ||
        k.includes("photo")
      ) {
        try {
          const val = window.localStorage.getItem(k);
          if (val && val.length > 35000) {
            keysToRemove.push(k);
          }
        } catch (_) {}
      }
    }

    // Purge identified items
    keysToRemove.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch (_) {}
    });
  } catch (e) {
    console.warn("[storageSafety] Erro ao limpar chaves volumosas:", e);
  }
}

/**
 * Install global hook on Storage.prototype.setItem to catch and heal QuotaExceededError
 */
export function initStorageSafety(): void {
  if (typeof window === "undefined" || !window.Storage) return;

  // Run initial proactive cleanup immediately on boot
  purgeBulkyStorage();

  const originalSetItem = window.Storage.prototype.setItem;

  // Avoid double patching
  if ((originalSetItem as any).__isSafeStoragePatched) {
    return;
  }

  const patchedSetItem = function (this: Storage, key: string, value: string) {
    // 1. Reject massive assets (>80KB) in cache keys upfront to preserve 5MB quota
    if (
      value &&
      value.length > 80000 &&
      (key.startsWith("davveroId_offline_") ||
        key.includes("logo") ||
        key.includes("signature") ||
        key.includes("image") ||
        key.includes("photo"))
    ) {
      console.warn(`[storageSafety] Bloqueada escrita de item volumoso (${Math.round(value.length / 1024)}KB) na chave "${key}" para proteger a cota do navegador.`);
      return;
    }

    try {
      originalSetItem.call(this, key, value);
    } catch (err: any) {
      const isFirestoreInternalKey =
        key.startsWith("firestore_clients_") ||
        key.startsWith("firestore_targets_") ||
        key.startsWith("firestore_mutations_") ||
        key.startsWith("firestore_online_state_") ||
        key.startsWith("firestore_sequence_number_");

      const isQuotaError =
        err &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22 ||
          err.code === 1014 ||
          err.number === -2147024882 ||
          (typeof err.message === "string" &&
            (err.message.includes("quota") ||
              err.message.includes("QuotaExceededError") ||
              err.message.includes("exceeded the quota"))));

      if (isQuotaError || isFirestoreInternalKey) {
        console.warn(`[storageSafety] Storage notice interceptado para chave "${key}". Executando auto-limpeza...`);
        purgeBulkyStorage();

        try {
          // Retry write after purging
          originalSetItem.call(this, key, value);
          return;
        } catch (retryErr) {
          // If still failing, purge all non-essential keys
          try {
            const secondaryKeys: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i);
              if (
                k &&
                !k.includes("auth") &&
                !k.includes("admin") &&
                !k.includes("user") &&
                !k.includes("pin") &&
                !k.includes("token")
              ) {
                secondaryKeys.push(k);
              }
            }
            secondaryKeys.forEach((k) => {
              try {
                window.localStorage.removeItem(k);
              } catch (_) {}
            });

            originalSetItem.call(this, key, value);
            return;
          } catch (finalErr) {
            console.warn(`[storageSafety] Não foi possível persistir "${key}" devido a limite estrito de armazenamento. Operação suprimida com segurança.`);
            // Do NOT rethrow error for Firestore internal tokens or temporary caches,
            // as this prevents the fatal FIRESTORE INTERNAL ASSERTION FAILED crash (b815)!
            if (isFirestoreInternalKey || isQuotaError) {
              return;
            }
          }
        }
      }

      // If it's not a quota error or internal token error, rethrow
      throw err;
    }
  };

  (patchedSetItem as any).__isSafeStoragePatched = true;
  window.Storage.prototype.setItem = patchedSetItem;
}

// Auto-run on module evaluation
initStorageSafety();
