export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const DAVVERO_HAPTICS_ENABLED = 'davveroId_haptics_enabled';

// In-memory cache to prevent blocking synchronous localStorage reads on every user click
let cachedHapticsEnabled: boolean | null = null;
let lastHapticTime = 0;

export const getHapticsEnabled = (): boolean => {
  if (cachedHapticsEnabled !== null) return cachedHapticsEnabled;
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(DAVVERO_HAPTICS_ENABLED);
    cachedHapticsEnabled = val === null ? true : val === 'true';
    return cachedHapticsEnabled;
  } catch {
    return true;
  }
};

export const setHapticsEnabled = (enabled: boolean) => {
  cachedHapticsEnabled = enabled;
  try {
    localStorage.setItem(DAVVERO_HAPTICS_ENABLED, enabled.toString());
  } catch {}
};

export const triggerHaptic = (type: HapticType = 'medium') => {
  if (!getHapticsEnabled()) return;
  const now = Date.now();
  if (now - lastHapticTime < 80) return;
  lastHapticTime = now;
  
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(8);
          break;
        case 'medium':
          navigator.vibrate(15);
          break;
        case 'heavy':
          navigator.vibrate(30);
          break;
        case 'success':
          navigator.vibrate([15, 40, 15]);
          break;
        case 'warning':
          navigator.vibrate([20, 40, 30]);
          break;
        case 'error':
          navigator.vibrate([40, 40, 40]);
          break;
        default:
          navigator.vibrate(15);
      }
    } catch {
      // Haptics not allowed or unsupported in current browsing context
    }
  }
};
