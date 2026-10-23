/**
 * GymTech Audio & Speech Announcement Engine
 * 
 * Provides synchronized earcons (pleasant Web Audio sound chimes) and
 * natural speech synthesis announcements for:
 * 1. Biometric registration ("Thank you! Biometric face registered successfully.")
 * 2. Duplicate face detection ("Duplicate! Face already registered for...")
 * 3. Successful check-in ("Thank you, [Name]! Enjoy your workout.")
 * 4. Duplicate entry ("Duplicate! [Name] has already checked in today.")
 * 5. Access denial ("Access denied! Membership is expired.")
 */

let audioCtx: AudioContext | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Initialize voice cache when available in browser
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const updateVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch {
      // Ignored
    }
  };
  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('gymtech_audio_muted') === 'true';
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('gymtech_audio_muted', muted ? 'true' : 'false');
  if (muted && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function toggleAudioMute(): boolean {
  const next = !isAudioMuted();
  setAudioMuted(next);
  return next;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play synthesizer musical chimes for instant acoustic feedback
 */
export function playChime(type: 'success' | 'warning' | 'error' | 'ping'): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    if (type === 'success') {
      // Uplifting 4-tone arpeggio (C5 -> E5 -> G5 -> C6)
      const notes = [
        { freq: 523.25, start: 0.0, dur: 0.12, gain: 0.18 },
        { freq: 659.25, start: 0.08, dur: 0.14, gain: 0.2 },
        { freq: 783.99, start: 0.16, dur: 0.18, gain: 0.22 },
        { freq: 1046.5, start: 0.26, dur: 0.35, gain: 0.25 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(n.gain, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      }
    } else if (type === 'warning') {
      // Attention-grabbing double pulse (F#5 -> D5 -> F#5)
      const notes = [
        { freq: 740, start: 0.0, dur: 0.12, gain: 0.22 },
        { freq: 587, start: 0.12, dur: 0.12, gain: 0.22 },
        { freq: 740, start: 0.24, dur: 0.2, gain: 0.24 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(n.gain, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      }
    } else if (type === 'error') {
      // Low dual warning buzzer
      const notes = [
        { freq: 220, start: 0.0, dur: 0.18, gain: 0.2 },
        { freq: 180, start: 0.16, dur: 0.24, gain: 0.22 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(n.gain, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      }
    } else if (type === 'ping') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {
    // AudioContext autoplay fallback
  }
}

/**
 * Speak voice announcement with optional earcon chime
 */
export function speakAnnouncement(
  text: string,
  options?: { chime?: 'success' | 'warning' | 'error' | 'ping'; delayMs?: number }
): void {
  if (typeof window === 'undefined' || isAudioMuted()) return;

  if (options?.chime) {
    playChime(options.chime);
  }

  if (!('speechSynthesis' in window)) return;

  try {
    // Unstick Chrome speech synthesis if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Zira') ||
              v.name.includes('Jenny') ||
              v.name.includes('Guy'))
        ) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    if (options?.delayMs) {
      setTimeout(doSpeak, options.delayMs);
    } else {
      doSpeak();
    }
  } catch (err) {
    console.warn('Speech synthesis notification failed:', err);
  }
}

/**
 * Triggers a test announcement so staff can verify speaker/volume setup
 */
export function testAudioAnnouncement(): void {
  speakAnnouncement('GymTech audio announcements are active and working.', { chime: 'success', delayMs: 150 });
}
