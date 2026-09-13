export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const DAVVERO_HAPTICS_ENABLED = 'davveroId_haptics_enabled';

// In-memory cache to prevent blocking synchronous localStorage reads on every user click
let cachedHapticsEnabled: boolean | null = null;

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
  
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(40);
          break;
        case 'success':
          navigator.vibrate([15, 50, 15]);
          break;
        case 'warning':
          navigator.vibrate([20, 50, 40]);
          break;
        case 'error':
          navigator.vibrate([50, 50, 50, 50, 50]);
          break;
        default:
          navigator.vibrate(20);
      }
    } catch {
      // Haptics not allowed or unsupported in current browsing context
    }
  }
};
