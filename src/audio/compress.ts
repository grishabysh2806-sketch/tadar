/*
 * Подготовка записи к отправке в общий аудиословарь.
 * Бесплатный тариф сервера маленький, поэтому файл должен весить десятки
 * килобайт: короткие записи с микрофона (32 кбит/с) уходят как есть, а большие
 * файлы из диктофона обрезаются по тишине (до 15 с), сводятся в моно
 * и пережимаются в Opus/AAC, а если браузер не умеет — в WAV 12 кГц.
 */

export const MAX_UPLOAD = 400_000;
const KEEP_AS_IS = 300_000;
const MAX_SECONDS = 15;

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
};
export const extFor = (mime: string) => EXT[mime] ?? 'bin';

/** Тип файла без параметров, приведённый к списку, который принимает хранилище. */
export function baseMime(type: string, name = ''): string | null {
  const t = (type || '').toLowerCase().split(';')[0].trim();
  const n = name.toLowerCase();
  if (t.includes('webm') || n.endsWith('.webm')) return 'audio/webm';
  if (t.includes('ogg') || t.includes('opus') || n.endsWith('.ogg') || n.endsWith('.opus')) return 'audio/ogg';
  if (t.includes('mp4') || t.includes('m4a') || n.endsWith('.m4a') || n.endsWith('.mp4')) return 'audio/mp4';
  if (t.includes('mpeg') || t.includes('mp3') || n.endsWith('.mp3')) return 'audio/mpeg';
  if (t.includes('wav') || t.includes('wave') || n.endsWith('.wav')) return 'audio/wav';
  if (t.includes('aac') || n.endsWith('.aac')) return 'audio/aac';
  return null;
}

/** Тип для записи с микрофона: Opus там, где он есть, иначе AAC (Safari). */
export function recorderMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  return '';
}

/** Битрейт записи голоса: для слов и коротких фраз хватает с запасом. */
export const VOICE_BITRATE = 32000;

type AC = typeof AudioContext;
const AudioCtx = (): AC | null => (typeof window === 'undefined' ? null : window.AudioContext || (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext || null);

async function decode(blob: Blob): Promise<AudioBuffer> {
  const Ctx = AudioCtx();
  if (!Ctx) throw new Error('no audio');
  const ctx = new Ctx();
  try {
    const data = await blob.arrayBuffer();
    return await new Promise<AudioBuffer>((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      p?.then?.(resolve, reject);
    });
  } finally {
    ctx.close?.().catch(() => undefined);
  }
}

/** Моно, без тишины по краям, не длиннее MAX_SECONDS, с нужной частотой. */
async function prepareBuffer(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels;
  }
  // тишина по краям: окна по 20 мс, порог от пика
  const win = Math.max(1, Math.round(buf.sampleRate * 0.02));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mono[i]));
  const thr = Math.max(0.01, peak * 0.06);
  const loud = (w: number) => {
    let sum = 0;
    const end = Math.min(n, w + win);
    for (let i = w; i < end; i++) sum += mono[i] * mono[i];
    return Math.sqrt(sum / Math.max(1, end - w)) > thr;
  };
  let a = 0;
  while (a < n && !loud(a)) a += win;
  let b = n;
  while (b > a && !loud(Math.max(0, b - win))) b -= win;
  const pad = Math.round(buf.sampleRate * 0.2);
  a = Math.max(0, a - pad);
  b = Math.min(n, b + pad, a + MAX_SECONDS * buf.sampleRate);
  if (b - a < buf.sampleRate * 0.3) {
    a = 0;
    b = Math.min(n, MAX_SECONDS * buf.sampleRate);
  }
  const len = Math.max(1, Math.ceil(((b - a) / buf.sampleRate) * rate));
  const off = new OfflineAudioContext(1, len, rate);
  const src = off.createBuffer(1, b - a, buf.sampleRate);
  src.getChannelData(0).set(mono.subarray(a, b));
  const node = off.createBufferSource();
  node.buffer = src;
  node.connect(off.destination);
  node.start();
  return off.startRendering();
}

/** Пережать в Opus/AAC через MediaRecorder (идёт в реальном времени, пару секунд). */
async function encodeCompressed(buf: AudioBuffer): Promise<Blob> {
  const Ctx = AudioCtx();
  const mime = recorderMime();
  if (!Ctx || !mime || typeof MediaRecorder === 'undefined') throw new Error('no encoder');
  const ctx = new Ctx();
  try {
    await ctx.resume?.();
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: VOICE_BITRATE });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime }));
      rec.onerror = () => reject(new Error('encode'));
    });
    const stop = () => rec.state !== 'inactive' && rec.stop();
    src.onended = () => setTimeout(stop, 200);
    const guard = setTimeout(stop, (buf.duration + 4) * 1000);
    rec.start();
    src.start();
    const blob = await done;
    clearTimeout(guard);
    if (blob.size < 800) throw new Error('empty');
    return blob;
  } finally {
    ctx.close?.().catch(() => undefined);
  }
}

function encodeWav(buf: AudioBuffer): Blob {
  const data = buf.getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + data.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + data.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

export interface Prepared {
  blob: Blob;
  mime: string;
  duration: number;
}

/** Файл, готовый к отправке: не больше MAX_UPLOAD и не длиннее 30 с. */
export async function prepareForUpload(blob: Blob, name = ''): Promise<Prepared> {
  const mime = baseMime(blob.type, name);
  let buf: AudioBuffer | null = null;
  try {
    buf = await decode(blob);
  } catch {
    buf = null;
  }
  const duration = buf ? buf.duration : 0;
  if (mime && blob.size <= KEEP_AS_IS && duration <= 30) {
    return { blob: blob.type === mime ? blob : new Blob([blob], { type: mime }), mime, duration };
  }
  if (!buf) throw new Error('decode');
  try {
    const small = await encodeCompressed(await prepareBuffer(buf, 24000));
    const m = baseMime(small.type);
    if (m && small.size <= MAX_UPLOAD) {
      const d = await decode(small).then(
        (b) => b.duration,
        () => Math.min(duration, MAX_SECONDS),
      );
      return { blob: new Blob([small], { type: m }), mime: m, duration: Math.min(30, d) };
    }
  } catch {
    /* ниже — запасной вариант */
  }
  const low = await prepareBuffer(buf, 12000);
  return { blob: encodeWav(low), mime: 'audio/wav', duration: low.duration };
}
