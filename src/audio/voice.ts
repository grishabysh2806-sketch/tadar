/*
 * Озвучка шорских слов.
 * 1) Если слово записано в «Голосах старших» — играем запись носителя.
 * 2) Иначе — синтез речи браузера. Шорских голосов нет, поэтому текст
 *    транслитерируется под ближайший тюркский голос (турецкий, казахский…),
 *    а при их отсутствии — под русский.
 */
import { getState } from '../state/store';
import { normalize } from '../lib/text';

/* ── IndexedDB: записи «Голосов старших» ───────────────────────── */

export interface Recording {
  id?: number;
  itemId?: string;
  text: string;
  ru: string;
  speaker: string;
  relation: string;
  place: string;
  createdAt: number;
  mime: string;
  duration: number;
  blob: Blob;
}

const DB_NAME = 'tadar-voices';
const STORE = 'recordings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB недоступна'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        st.createIndex('text', 'text');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const urlByText = new Map<string, string>();
const recListeners = new Set<() => void>();
export const onRecordingsChange = (l: () => void) => {
  recListeners.add(l);
  return () => {
    recListeners.delete(l);
  };
};

export async function listRecordings(): Promise<Recording[]> {
  try {
    const all = await tx<Recording[]>('readonly', (st) => st.getAll() as IDBRequest<Recording[]>);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

async function rebuildIndex() {
  const all = await listRecordings();
  urlByText.forEach((u) => URL.revokeObjectURL(u));
  urlByText.clear();
  // самая свежая запись побеждает
  for (const r of [...all].reverse()) urlByText.set(normalize(r.text), URL.createObjectURL(r.blob));
  recListeners.forEach((l) => l());
}

export async function saveRecording(r: Recording) {
  await tx('readwrite', (st) => st.add(r));
  await rebuildIndex();
}

export async function deleteRecording(id: number) {
  await tx('readwrite', (st) => st.delete(id));
  await rebuildIndex();
}

export const hasRecording = (text: string) => urlByText.has(normalize(text));
export const recordedTexts = () => new Set(urlByText.keys());

export function initVoices() {
  rebuildIndex().catch(() => undefined);
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => voiceListeners.forEach((l) => l()));
  }
}

/* ── Синтез речи ───────────────────────────────────────────────── */

const voiceListeners = new Set<() => void>();
export const onVoicesChange = (l: () => void) => {
  voiceListeners.add(l);
  return () => {
    voiceListeners.delete(l);
  };
};

export const ttsSupported = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const PREFERRED = ['tr', 'kk', 'az', 'uz', 'ky', 'tt', 'ba', 'ru'];

export function availableVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return speechSynthesis.getVoices();
}

export function voiceOptions() {
  const vs = availableVoices();
  return vs
    .filter((v) => PREFERRED.includes(v.lang.slice(0, 2).toLowerCase()))
    .sort((a, b) => PREFERRED.indexOf(a.lang.slice(0, 2).toLowerCase()) - PREFERRED.indexOf(b.lang.slice(0, 2).toLowerCase()));
}

export function pickVoice(): SpeechSynthesisVoice | null {
  const vs = availableVoices();
  if (!vs.length) return null;
  const pref = getState().settings.voice;
  if (pref) {
    const v = vs.find((x) => x.voiceURI === pref);
    if (v) return v;
  }
  for (const lang of PREFERRED) {
    const cands = vs.filter((v) => v.lang.toLowerCase().startsWith(lang));
    if (cands.length) return cands.find((v) => /google|premium|enhanced|yelda|milena/i.test(v.name)) ?? cands[0];
  }
  return vs.find((v) => v.default) ?? vs[0];
}

const LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'k',
  л: 'l', м: 'm', н: 'n', ң: 'ng', о: 'o', ӧ: 'ö', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ӱ: 'ü', ф: 'f', х: 'h',
  ц: 'ts', ч: 'ç', ш: 'ş', щ: 'şç', ъ: '', ы: 'ı', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function toLatin(s: string) {
  let outS = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    const m = LAT[low];
    if (m === undefined) {
      outS += ch;
      continue;
    }
    outS += ch !== low && m ? m[0].toUpperCase() + m.slice(1) : m;
  }
  return outS;
}

function toKazakh(s: string) {
  return s.replace(/ӧ/g, 'ө').replace(/Ӧ/g, 'Ө').replace(/ӱ/g, 'ү').replace(/Ӱ/g, 'Ү');
}

function toRussian(s: string) {
  return s
    .replace(/ң/g, 'нг')
    .replace(/Ң/g, 'Нг')
    .replace(/[ғ]/g, 'г')
    .replace(/[Ғ]/g, 'Г')
    .replace(/[қ]/g, 'к')
    .replace(/[Қ]/g, 'К')
    .replace(/(^|[\s-])ӧ/g, '$1о')
    .replace(/(^|[\s-])Ӧ/g, '$1О')
    .replace(/(^|[\s-])ӱ/g, '$1у')
    .replace(/(^|[\s-])Ӱ/g, '$1У')
    .replace(/ӧ/g, 'ё')
    .replace(/ӱ/g, 'ю');
}

export function speakable(text: string, lang: string) {
  const l = lang.slice(0, 2).toLowerCase();
  const clean = text.replace(/-$/g, '').replace(/(\S)-(\s|$)/g, '$1$2');
  if (l === 'tr' || l === 'az' || l === 'uz') return toLatin(clean);
  if (l === 'kk' || l === 'ky' || l === 'tt' || l === 'ba') return toKazakh(clean);
  return toRussian(clean);
}

let current: HTMLAudioElement | null = null;

export function stopSpeech() {
  if (current) {
    current.pause();
    current = null;
  }
  if (ttsSupported()) speechSynthesis.cancel();
}

export function canSpeak() {
  return ttsSupported() || urlByText.size > 0;
}

/** Произнести шорский текст. Возвращает промис окончания. */
export function speakShor(text: string, opts: { slow?: boolean; force?: boolean } = {}): Promise<void> {
  const st = getState().settings;
  if (!st.tts && !opts.force) return Promise.resolve();
  stopSpeech();
  const rec = urlByText.get(normalize(text));
  if (rec) {
    return new Promise((resolve) => {
      const a = new Audio(rec);
      current = a;
      a.playbackRate = opts.slow ? 0.75 : 1;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
  }
  if (!ttsSupported()) return Promise.resolve();
  return new Promise((resolve) => {
    const v = pickVoice();
    const lang = v?.lang ?? 'ru-RU';
    const u = new SpeechSynthesisUtterance(speakable(text, lang));
    if (v) u.voice = v;
    u.lang = lang;
    u.rate = opts.slow ? Math.max(0.4, st.rate * 0.6) : st.rate;
    u.pitch = 1;
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    u.onend = fin;
    u.onerror = fin;
    setTimeout(fin, 6000);
    try {
      speechSynthesis.speak(u);
    } catch {
      fin();
    }
  });
}

/** Русская подсказка голосом (для режима без чтения). */
export function speakRu(text: string) {
  if (!ttsSupported()) return;
  const v = availableVoices().find((x) => x.lang.startsWith('ru'));
  const u = new SpeechSynthesisUtterance(text);
  if (v) u.voice = v;
  u.lang = 'ru-RU';
  speechSynthesis.speak(u);
}

export function voiceLabel(v: SpeechSynthesisVoice | null) {
  if (!v) return 'нет голоса';
  const names: Record<string, string> = { tr: 'турецкий', kk: 'казахский', az: 'азербайджанский', uz: 'узбекский', ky: 'киргизский', tt: 'татарский', ba: 'башкирский', ru: 'русский' };
  return `${v.name} · ${names[v.lang.slice(0, 2).toLowerCase()] ?? v.lang}`;
}
