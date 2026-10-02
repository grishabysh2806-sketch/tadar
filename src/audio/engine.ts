/* Общий AudioContext и звуковые эффекты (синтез, без файлов). */
import { getState } from '../state/store';

let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

/** Разблокировка звука на мобильных: вызывается по первому касанию. */
export function unlockAudio() {
  // иначе iPhone глушит музыку кая переключателем «Без звука»
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* noop */
  }
  const c = audioCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => undefined);
}

function tone(
  c: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; attack?: number; glideTo?: number } = {},
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, start);
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, start + dur);
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function out(c: AudioContext) {
  const g = c.createGain();
  g.gain.value = 0.9;
  g.connect(c.destination);
  return g;
}

export type Sfx = 'correct' | 'wrong' | 'tap' | 'pop' | 'complete' | 'streak' | 'chest' | 'heart' | 'match' | 'unlock' | 'select';

export function sfx(name: Sfx, pitch = 0) {
  if (!getState().settings.sfx) return;
  const c = audioCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  const t = c.currentTime + 0.01;
  const d = out(c);
  const semis = (n: number) => Math.pow(2, n / 12);
  switch (name) {
    case 'correct': {
      tone(c, d, 659.25, t, 0.16, { type: 'triangle', gain: 0.22 });
      tone(c, d, 987.77, t + 0.09, 0.32, { type: 'triangle', gain: 0.22 });
      tone(c, d, 1975.5, t + 0.09, 0.25, { type: 'sine', gain: 0.05 });
      break;
    }
    case 'wrong': {
      tone(c, d, 220, t, 0.18, { type: 'square', gain: 0.07, glideTo: 180 });
      tone(c, d, 164.8, t + 0.12, 0.3, { type: 'square', gain: 0.07, glideTo: 140 });
      break;
    }
    case 'tap':
      tone(c, d, 880, t, 0.05, { type: 'sine', gain: 0.06 });
      break;
    case 'select':
      tone(c, d, 1046.5, t, 0.06, { type: 'triangle', gain: 0.06 });
      break;
    case 'pop':
      tone(c, d, 520, t, 0.08, { type: 'sine', gain: 0.12, glideTo: 900 });
      break;
    case 'match': {
      const f = 523.25 * semis(pitch * 2);
      tone(c, d, f, t, 0.12, { type: 'triangle', gain: 0.16 });
      tone(c, d, f * 1.5, t + 0.06, 0.18, { type: 'sine', gain: 0.08 });
      break;
    }
    case 'complete': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone(c, d, f, t + i * 0.11, 0.35, { type: 'triangle', gain: 0.18 }));
      [523.25, 659.25, 783.99].forEach((f) => tone(c, d, f, t + 0.5, 0.9, { type: 'sine', gain: 0.08, attack: 0.05 }));
      break;
    }
    case 'streak': {
      tone(c, d, 300, t, 0.4, { type: 'sawtooth', gain: 0.04, glideTo: 1200 });
      tone(c, d, 1318.5, t + 0.35, 0.6, { type: 'triangle', gain: 0.16 });
      tone(c, d, 1760, t + 0.45, 0.6, { type: 'sine', gain: 0.08 });
      break;
    }
    case 'chest': {
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, d, f, t + i * 0.06, 0.3, { type: 'triangle', gain: 0.12 }));
      break;
    }
    case 'heart':
      tone(c, d, 140, t, 0.25, { type: 'sine', gain: 0.25, glideTo: 70 });
      break;
    case 'unlock': {
      tone(c, d, 587.33, t, 0.12, { type: 'triangle', gain: 0.14 });
      tone(c, d, 880, t + 0.1, 0.4, { type: 'triangle', gain: 0.14 });
      break;
    }
  }
}

export function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
}
