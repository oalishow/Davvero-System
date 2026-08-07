export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const DAVVERO_HAPTICS_ENABLED = 'davveroId_haptics_enabled';

export const getHapticsEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(DAVVERO_HAPTICS_ENABLED);
  return val === null ? true : val === 'true';
};

export const setHapticsEnabled = (enabled: boolean) => {
  localStorage.setItem(DAVVERO_HAPTICS_ENABLED, enabled.toString());
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
    } catch (e) {
      console.warn('Haptic feedback failed', e);
    }
  }
};
