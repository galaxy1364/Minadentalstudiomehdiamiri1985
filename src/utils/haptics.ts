/**
 * iOS 27 Next-Gen Tactile & Haptic Engine
 * Provides authentic iOS tactile sensory feedback via Web Vibration API
 * with instant fallback to micro-audio impulse synthesizer for devices without vibration motor.
 */

import { hardwareBridgeService, DeviceHapticIntensity } from '../services/hardwareBridgeService';

export type HapticType = 
  | 'light' 
  | 'medium' 
  | 'heavy' 
  | 'selection' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'gesture' 
  | 'spring';

export type HapticIntensityLevel = 'none' | 'light' | 'medium' | 'heavy' | 'off';

export function normalizeHapticIntensity(level: HapticIntensityLevel | string | null | undefined): DeviceHapticIntensity {
  if (!level || level === 'none' || level === 'off') return 'none';
  if (level === 'light') return 'light';
  if (level === 'heavy') return 'heavy';
  return 'medium';
}

const HAPTIC_INTENSITY_STORAGE_KEY = 'minadental_haptic_intensity_v1';

// In-memory cache for ultra-fast ProMotion reads without localStorage lag
let currentHapticIntensity: HapticIntensityLevel = (() => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(HAPTIC_INTENSITY_STORAGE_KEY) as HapticIntensityLevel | null;
      if (stored === 'none' || stored === 'off' || stored === 'light' || stored === 'medium' || stored === 'heavy') {
        return stored;
      }
    } catch {}
  }
  return 'medium';
})();

export function getHapticIntensity(): HapticIntensityLevel {
  return currentHapticIntensity;
}

export function setHapticIntensity(level: HapticIntensityLevel): void {
  currentHapticIntensity = level;
  const normalized = normalizeHapticIntensity(level);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(HAPTIC_INTENSITY_STORAGE_KEY, level);
      window.dispatchEvent(new CustomEvent('minadental_haptic_intensity_changed', { detail: level }));
    } catch {}
  }
  // Sync intensity with physical device hardware bridge
  hardwareBridgeService.setHapticIntensity(normalized);
}

// Audio Context & iOS 27 Native Switch Taptic Engine Bridge
let audioCtx: AudioContext | null = null;
let acousticFeedbackEnabled = true;
let lastHapticTimestamp = 0;
let iosSwitchLabel: HTMLLabelElement | null = null;

function triggerIosNativeSwitchHaptic(): void {
  if (typeof document === 'undefined') return;
  try {
    if (!iosSwitchLabel) {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.setAttribute('aria-hidden', 'true');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'minadental-ios27-taptic-switch';
      input.setAttribute('switch', '');

      const label = document.createElement('label');
      label.htmlFor = 'minadental-ios27-taptic-switch';

      container.appendChild(input);
      container.appendChild(label);
      document.body.appendChild(container);
      iosSwitchLabel = label;
    }
    iosSwitchLabel.click();
  } catch {
    // Graceful no-op on non-switch browsers
  }
}

export function setAcousticFeedbackEnabled(enabled: boolean): void {
  acousticFeedbackEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('minadental_acoustic_feedback', enabled ? 'true' : 'false');
    } catch {}
  }
}

export function getAcousticFeedbackEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('minadental_acoustic_feedback');
      if (stored !== null) return stored === 'true';
    } catch {}
  }
  return acousticFeedbackEnabled;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playSynthesizedHapticTick(frequency = 180, duration = 0.012, gainVal = 0.06) {
  if (!getAcousticFeedbackEnabled()) return;
  const rawIntensity = getHapticIntensity();
  const intensity = normalizeHapticIntensity(rawIntensity);
  if (intensity === 'none') return;

  const gainScale = intensity === 'light' ? 0.65 : intensity === 'heavy' ? 1.45 : 1.0;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal * gainScale, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Ignore audio context errors silently
  }
}

/**
 * Scale vibration pattern duration based on active haptic intensity level
 */
function scaleVibrationPattern(pattern: number | number[], scale: number): number | number[] {
  if (typeof pattern === 'number') {
    return Math.max(1, Math.round(pattern * scale));
  }
  return pattern.map((dur, idx) => (idx % 2 === 0 ? Math.max(1, Math.round(dur * scale)) : dur));
}

/**
 * Triggers genuine iOS 27 Taptic Engine + Android Vibration + Zero-Latency Micro-Impulse
 * Adjusted dynamically by the global Haptic Intensity Level ('none' | 'light' | 'medium' | 'heavy')
 * and passes the intensity level directly to the device hardware bridge.
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined') return;

  const rawIntensity = getHapticIntensity();
  const intensity = normalizeHapticIntensity(rawIntensity);

  // Directly pass the intensity level to the physical device hardware bridge
  hardwareBridgeService.sendHapticFeedback(type, intensity);

  // If intensity is set to 'none' (None / Off), exit immediately without physical vibration or synthesized sound
  if (intensity === 'none') return;

  // 16ms ProMotion frame throttle to prevent main-thread congestion on rapid taps
  const now = performance.now();
  if (now - lastHapticTimestamp < 16) return;
  lastHapticTimestamp = now;

  const hasVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  // Intensity multipliers (light = 0.55x, medium = 1.0x, heavy = 1.6x for surgical gloves)
  const vibeScale = intensity === 'light' ? 0.55 : intensity === 'heavy' ? 1.6 : 1.0;

  try {
    if (!hasVibrate) {
      triggerIosNativeSwitchHaptic();
    }

    switch (type) {
      case 'light':
      case 'selection':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern(10, vibeScale));
        playSynthesizedHapticTick(240, 0.009, 0.035);
        break;

      case 'medium':
      case 'gesture':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern(20, vibeScale));
        playSynthesizedHapticTick(200, 0.015, 0.06);
        break;

      case 'heavy':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern(34, vibeScale));
        playSynthesizedHapticTick(140, 0.022, 0.1);
        break;

      case 'spring':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern([10, 28, 14], vibeScale));
        playSynthesizedHapticTick(280, 0.011, 0.05);
        setTimeout(() => playSynthesizedHapticTick(340, 0.014, 0.07), 32);
        break;

      case 'success':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern([14, 36, 22], vibeScale));
        playSynthesizedHapticTick(300, 0.014, 0.07);
        setTimeout(() => playSynthesizedHapticTick(420, 0.018, 0.09), 42);
        break;

      case 'warning':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern([22, 45, 28], vibeScale));
        playSynthesizedHapticTick(180, 0.025, 0.08);
        break;

      case 'error':
        if (hasVibrate) navigator.vibrate(scaleVibrationPattern([36, 55, 36, 55, 45], vibeScale));
        playSynthesizedHapticTick(120, 0.028, 0.1);
        setTimeout(() => playSynthesizedHapticTick(100, 0.028, 0.1), 65);
        break;
    }
  } catch {
    // Graceful no-op
  }
}

/**
 * Preview a specific haptic intensity level to provide immediate tactile confirmation
 */
export function previewHapticIntensity(level: HapticIntensityLevel): void {
  const normalized = normalizeHapticIntensity(level);
  hardwareBridgeService.sendHapticFeedback('preview', normalized);
  if (normalized === 'none') return;
  const prevLevel = currentHapticIntensity;
  currentHapticIntensity = level;
  triggerHaptic('medium');
  currentHapticIntensity = prevLevel;
}
