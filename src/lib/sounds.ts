import { triggerHaptic } from './haptics';

const DAVVERO_SOUND_VOLUME = 'davveroId_sound_volume';

export const getSoundVolume = (): number => {
  const vol = localStorage.getItem(DAVVERO_SOUND_VOLUME);
  if (vol === null) return 0.05; // default volume
  return parseFloat(vol);
};

export const setSoundVolume = (vol: number) => {
  localStorage.setItem(DAVVERO_SOUND_VOLUME, vol.toString());
};

let sharedAudioContext: AudioContext | any = null;

export const playSound = (type: 'click' | 'success' | 'error' | 'notification' | 'pop' | 'flip' | 'scan' | 'generating' | 'login' | 'logout' | 'enroll') => {
  // Trigger haptic feedback based on sound type
  if (type === 'error') {
    triggerHaptic('error');
  } else if (type === 'success' || type === 'login' || type === 'enroll') {
    triggerHaptic('success');
  } else if (type === 'notification' || type === 'scan') {
    triggerHaptic('medium');
  } else if (type === 'click' || type === 'pop' || type === 'flip') {
    triggerHaptic('light');
  } else if (type === 'generating') {
    triggerHaptic('heavy');
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContextClass();
    }
    
    const ctx = sharedAudioContext;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const vol = getSoundVolume();

    if (vol <= 0) return; // Muted

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'flip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
      gain.gain.setValueAtTime(vol * 0.4, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1200, now + 0.05);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'generating') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(554.37, now + 0.15); // C#5
      osc.frequency.setValueAtTime(659.25, now + 0.3); // E5
      osc.frequency.setValueAtTime(880, now + 0.45); // A5
      osc.frequency.setValueAtTime(1108.73, now + 0.6); // C#6
      osc.frequency.setValueAtTime(1318.51, now + 0.75); // E6
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.4, now + 0.1);
      gain.gain.setValueAtTime(vol * 0.4, now + 0.6);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.9);
      osc.start(now);
      osc.stop(now + 0.9);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.1);
      osc.frequency.setValueAtTime(1000, now + 0.2);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.2);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'notification') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'login') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
      osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
      gain.gain.setValueAtTime(vol, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'logout') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
      osc.frequency.setValueAtTime(440, now + 0.2); // A4
      gain.gain.setValueAtTime(vol, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'enroll') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.warn('Audio playback failed', e);
  }
};
