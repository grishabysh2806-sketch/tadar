/*
 * Синтез музыкального сопровождения эпоса кай прямо в браузере:
 *  — горловой гул (кай): пила + субгармоника, формантные фильтры «поют» гласные,
 *    узкий фильтр выделяет свистящую обертоновую мелодию;
 *  — кай-комус: двухструнный щипковый инструмент (алгоритм Карплуса–Стронга),
 *    ритм «скачущего коня»;
 *  — темир-комус (варган) и шум ветра в тайге.
 * Это демо-озвучка: в приложении её заменят записи сказителей.
 */
import { audioCtx } from './engine';

export interface KaiMood {
  root: number;
  tempo: number;
  komus: 'gallop' | 'walk' | 'still';
  overtone: number[];
}

const VOWELS: Record<string, [number, number, number]> = {
  а: [750, 1200, 2500],
  о: [520, 900, 2400],
  ы: [380, 1500, 2400],
  у: [340, 750, 2300],
  э: [520, 1750, 2500],
};
const VKEYS = Object.keys(VOWELS);

function impulse(c: AudioContext, seconds = 2.8, decay = 2.6) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function pluckBuffer(c: AudioContext, freq: number, seconds = 2.2, bright = 0.5) {
  const sr = c.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = c.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  // мягкий «медиатор»
  for (let i = 1; i < period; i++) ring[i] = ring[i] * bright + ring[i - 1] * (1 - bright);
  let idx = 0;
  const damp = 0.996;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = ring[idx];
    ring[idx] = ((v + ring[next]) / 2) * damp;
    d[i] = v;
    idx = next;
  }
  // плавное затухание в конце
  const fade = Math.floor(sr * 0.2);
  for (let i = 0; i < fade; i++) d[len - fade + i] *= 1 - i / fade;
  return buf;
}

function noiseBuffer(c: AudioContext, seconds = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export class KaiSynth {
  readonly analyser: AnalyserNode | null = null;
  private c: AudioContext | null;
  private master: GainNode | null = null;
  private stopFns: (() => void)[] = [];
  private timers: number[] = [];
  private schedTimer = 0;
  private plucks = new Map<number, AudioBuffer>();
  playing = false;
  startedAt = 0;
  /** Громкость музыки: тише, когда звучит голос рассказчика. */
  private level = 0.9;

  constructor() {
    this.c = audioCtx();
    if (!this.c) return;
    const c = this.c;
    this.master = c.createGain();
    this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    const an = c.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.82;
    this.master.connect(comp).connect(an).connect(c.destination);
    (this as { analyser: AnalyserNode | null }).analyser = an;
  }

  get ok() {
    return !!this.c;
  }

  private pluck(freq: number) {
    const key = Math.round(freq);
    let b = this.plucks.get(key);
    if (!b && this.c) {
      b = pluckBuffer(this.c, freq);
      this.plucks.set(key, b);
    }
    return b!;
  }

  /** Запуск. onLine(i) вызывается в момент начала i-й строки текста. */
  start(mood: KaiMood, lineDurations: number[], onLine: (i: number) => void, onEnd: () => void, opts: { music: boolean; duck?: boolean } = { music: true }) {
    const c = this.c;
    if (!c || !this.master) {
      // без звука — просто ведём текст по таймеру
      let t = 2000;
      lineDurations.forEach((d, i) => {
        this.timers.push(window.setTimeout(() => onLine(i), t));
        t += d * 1000;
      });
      this.timers.push(window.setTimeout(onEnd, t + 1500));
      this.playing = true;
      return;
    }
    if (c.state === 'suspended') c.resume().catch(() => undefined);
    this.stop(true);
    this.playing = true;
    const t0 = c.currentTime + 0.1;
    this.startedAt = t0;
    const intro = 3;
    const total = intro + lineDurations.reduce((a, b) => a + b, 0) + 3.5;
    const end = t0 + total;

    this.level = opts.duck ? 0.42 : 0.9;
    const lv = opts.music ? this.level : 0;
    this.master.gain.cancelScheduledValues(t0);
    this.master.gain.setValueAtTime(0, t0);
    this.master.gain.linearRampToValueAtTime(lv, t0 + 1.5);
    this.master.gain.setValueAtTime(lv, end - 3);
    this.master.gain.linearRampToValueAtTime(0, end);

    const reverb = c.createConvolver();
    reverb.buffer = impulse(c);
    const wet = c.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(this.master);
    const bus = c.createGain();
    bus.connect(this.master);
    bus.connect(reverb);

    this.voice(mood, t0 + 1.2, end - 0.5, bus);
    this.wind(t0, end, bus);
    this.komus(mood, t0, end, bus);

    let tl = (t0 - c.currentTime + intro) * 1000;
    lineDurations.forEach((d, i) => {
      this.timers.push(window.setTimeout(() => onLine(i), tl));
      tl += d * 1000;
    });
    this.timers.push(
      window.setTimeout(() => {
        this.playing = false;
        onEnd();
      }, (end - c.currentTime) * 1000 + 200),
    );
  }

  /* Горловой гул с гласными и обертонами */
  private voice(m: KaiMood, start: number, end: number, out: AudioNode) {
    const c = this.c!;
    const f0 = m.root;
    const src = c.createGain();
    src.gain.value = 0.5;
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = f0;
    const o2 = c.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = f0 * 1.004;
    const sub = c.createOscillator();
    sub.type = 'square';
    sub.frequency.value = f0 / 2;
    const subG = c.createGain();
    subG.gain.value = 0.16;
    // вибрато
    const vib = c.createOscillator();
    vib.frequency.value = 4.6;
    const vibG = c.createGain();
    vibG.gain.value = 0.9;
    vib.connect(vibG);
    vibG.connect(o1.frequency);
    vibG.connect(o2.frequency);
    o1.connect(src);
    o2.connect(src);
    sub.connect(subG).connect(src);

    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.8);
    }
    shaper.curve = curve;
    src.connect(shaper);

    const env = c.createGain();
    env.gain.value = 0;
    const formants = [0, 1, 2].map((i) => {
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = [6, 11, 14][i];
      const g = c.createGain();
      g.gain.value = [1.0, 0.55, 0.22][i];
      shaper.connect(f).connect(g).connect(env);
      return f;
    });
    const whistle = c.createBiquadFilter();
    whistle.type = 'bandpass';
    whistle.Q.value = 38;
    const whG = c.createGain();
    whG.gain.value = 0.0;
    shaper.connect(whistle).connect(whG).connect(env);
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 3200;
    env.connect(low).connect(out);

    // фразы: пение ~6–7 с, вдох ~0.9 с
    let t = start;
    let vi = 0;
    let note = 0;
    const beat = 60 / m.tempo;
    while (t < end - 1) {
      const phrase = Math.min(6 + Math.random() * 1.5, end - t - 0.5);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.55, t + 0.35);
      env.gain.setValueAtTime(0.55, t + phrase - 0.5);
      env.gain.exponentialRampToValueAtTime(0.0001, t + phrase);
      // гласные
      let tv = t;
      while (tv < t + phrase) {
        const v = VOWELS[VKEYS[vi++ % VKEYS.length]];
        formants.forEach((f, i) => f.frequency.setTargetAtTime(v[i], tv, 0.08));
        tv += beat * (1 + (vi % 3 === 0 ? 1 : 0));
      }
      // обертоновая мелодия во второй половине фразы
      let tn = t + phrase * 0.35;
      whG.gain.setTargetAtTime(0.9, tn, 0.3);
      while (tn < t + phrase - 0.4) {
        const h = m.overtone[note++ % m.overtone.length];
        whistle.frequency.setTargetAtTime(f0 * h, tn, 0.04);
        tn += beat * 2;
      }
      whG.gain.setTargetAtTime(0, t + phrase - 0.4, 0.15);
      t += phrase + 0.9;
    }
    [o1, o2, sub, vib].forEach((o) => {
      o.start(start);
      o.stop(end + 0.5);
    });
    this.stopFns.push(() => [o1, o2, sub, vib].forEach((o) => safeStop(o)));
  }

  /* Кай-комус: ритм коня */
  private komus(m: KaiMood, start: number, end: number, out: AudioNode) {
    const c = this.c!;
    const g = c.createGain();
    g.gain.value = 0.55;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    g.connect(tone).connect(out);
    const beat = 60 / m.tempo;
    const r = m.root * 2;
    const scale = [r, r * 1.125, r * 1.333, r * 1.5, r * 2];
    const pattern: { at: number; f: number; v: number }[] = [];
    if (m.komus === 'gallop') {
      // та-та-ТАМ
      pattern.push({ at: 0, f: r, v: 1 }, { at: 0.5, f: r * 1.5, v: 0.5 }, { at: 0.75, f: r * 1.5, v: 0.55 });
    } else if (m.komus === 'walk') {
      pattern.push({ at: 0, f: r, v: 0.9 }, { at: 0.5, f: r * 1.333, v: 0.45 });
    } else {
      pattern.push({ at: 0, f: r, v: 0.8 });
    }
    let bar = 0;
    let t = start + 0.2;
    const lookahead = () => {
      const now = c.currentTime;
      while (t < Math.min(end - 1.5, now + 0.5)) {
        const step = m.komus === 'still' ? beat * 2 : beat;
        for (const p of pattern) {
          let f = p.f;
          // верхняя струна иногда ведёт мелодию
          if (p.at > 0 && bar % 4 === 3) f = scale[(bar + Math.round(p.at * 4)) % scale.length];
          this.playPluck(f, t + p.at * step, p.v * (0.85 + Math.random() * 0.25), g);
          // нижняя струна-бурдон на сильную долю
          if (p.at === 0 && bar % 2 === 0) this.playPluck(m.root, t, 0.35, g);
        }
        if (m.komus === 'still' && bar % 3 === 1) this.jaw(m.root, t + beat, out);
        t += step;
        bar++;
      }
    };
    lookahead();
    this.schedTimer = window.setInterval(lookahead, 120);
  }

  private playPluck(freq: number, when: number, vel: number, out: AudioNode) {
    const c = this.c!;
    const s = c.createBufferSource();
    s.buffer = this.pluck(freq);
    const g = c.createGain();
    g.gain.value = 0.5 * vel;
    s.connect(g).connect(out);
    s.start(when);
    s.stop(when + 2.2);
  }

  /* Варган: «бау-у-ум» с бегущим фильтром */
  private jaw(f0: number, when: number, out: AudioNode) {
    const c = this.c!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f0;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 18;
    bp.frequency.setValueAtTime(f0 * 6, when);
    bp.frequency.exponentialRampToValueAtTime(f0 * 12, when + 0.35);
    bp.frequency.exponentialRampToValueAtTime(f0 * 8, when + 0.9);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.4, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
    o.connect(bp).connect(g).connect(out);
    o.start(when);
    o.stop(when + 1.2);
  }

  /* Ветер в тайге */
  private wind(start: number, end: number, out: AudioNode) {
    const c = this.c!;
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c);
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.05;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = c.createGain();
    lg.gain.value = 0.035;
    lfo.connect(lg).connect(g.gain);
    const lfo2 = c.createOscillator();
    lfo2.frequency.value = 0.05;
    const lg2 = c.createGain();
    lg2.gain.value = 260;
    lfo2.connect(lg2).connect(bp.frequency);
    n.connect(bp).connect(g).connect(out);
    [n, lfo, lfo2].forEach((x) => {
      x.start(start);
      x.stop(end + 0.5);
    });
    this.stopFns.push(() => [n, lfo, lfo2].forEach((x) => safeStop(x)));
  }

  setMusic(on: boolean) {
    if (!this.c || !this.master) return;
    const t = this.c.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? this.level : 0, t, 0.2);
  }

  /** Плавно закончить (голос рассказчика дочитал раньше, чем кончилась музыка). */
  fadeOut(seconds = 2.5) {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    if (this.c && this.master) {
      const t = this.c.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + seconds);
    }
    const fns = this.stopFns;
    this.stopFns = [];
    window.setTimeout(() => fns.forEach((f) => f()), seconds * 1000 + 100);
    this.playing = false;
  }

  stop(silent = false) {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    window.clearInterval(this.schedTimer);
    if (this.c && this.master) {
      const t = this.c.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0, t, silent ? 0.01 : 0.15);
    }
    const fns = this.stopFns;
    this.stopFns = [];
    window.setTimeout(() => fns.forEach((f) => f()), silent ? 30 : 600);
    this.playing = false;
  }
}

function safeStop(n: AudioScheduledSourceNode) {
  try {
    n.stop();
  } catch {
    /* уже остановлен */
  }
}

/** Длительность строки по её длине. */
export const lineDuration = (s: string) => Math.min(7.5, 2.6 + s.length * 0.055);
