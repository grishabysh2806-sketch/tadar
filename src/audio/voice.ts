/*
 * Озвучка шорских слов.
 * 1) Если слово записано в «Голосах старших» на этом устройстве — играем эту запись.
 * 2) Иначе — проверенная запись из общего аудиословаря (сервер).
 * 3) Иначе — синтез речи браузера. Шорских голосов нет, поэтому текст
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
  /** Копия в общем аудиословаре: id строки, путь файла и статус проверки. */
  remoteId?: string;
  remotePath?: string;
  remoteStatus?: 'pending' | 'approved' | 'rejected';
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

/** Сохранить запись на устройстве; возвращает её id. */
export async function saveRecording(r: Recording): Promise<number> {
  const id = await tx<IDBValidKey>('readwrite', (st) => st.add(r));
  await rebuildIndex();
  return Number(id);
}

export async function deleteRecording(id: number) {
  await tx('readwrite', (st) => st.delete(id));
  await rebuildIndex();
}

/** Обновить запись (например, отметку об отправке в общий словарь). */
export async function updateRecording(r: Recording) {
  await tx('readwrite', (st) => st.put(r));
  await rebuildIndex();
}

/* ── Общий аудиословарь: проверенные записи с сервера ───────────── */

const communityByText = new Map<string, string>();

/** Список проверенных записей: текст → ссылка на файл (свежие идут первыми). */
export function setCommunityVoices(list: { text: string; url: string }[]) {
  communityByText.clear();
  for (const r of [...list].reverse()) communityByText.set(normalize(r.text), r.url);
  recListeners.forEach((l) => l());
}

export const hasCommunityVoice = (text: string) => communityByText.has(normalize(text));
export const communityTexts = () => new Set(communityByText.keys());

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
let cancelledAt = 0;

export function stopSpeech() {
  if (current) {
    current.pause();
    current = null;
  }
  // отменяем только то, что звучит: лишний cancel() на Android и в Chrome глотает следующую фразу
  if (ttsSupported() && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
    cancelledAt = Date.now();
  }
}

const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** iOS разрешает синтез речи только после касания — «будим» его пустой фразой (только iOS: на Android она может застрять в очереди). */
let speechUnlocked = false;
export function unlockSpeech() {
  if (speechUnlocked || !ttsSupported() || !IOS) return;
  speechUnlocked = true;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}

/** Синтез так и не заговорил — подсказать человеку один раз за сеанс. */
const issueListeners = new Set<() => void>();
let issueShown = false;
export const onSpeechIssue = (l: () => void) => {
  issueListeners.add(l);
  return () => {
    issueListeners.delete(l);
  };
};

/** На Android голоса загружаются не сразу — ждём их немного перед первой фразой. */
function voicesReady(ms = 1200): Promise<void> {
  if (!ttsSupported() || speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      speechSynthesis.removeEventListener?.('voiceschanged', done);
      resolve();
    }
    speechSynthesis.addEventListener?.('voiceschanged', done);
  });
}

/* ── Медленно: по слогам, как произносит учитель ───────────────── */

const VOWELS = /[аеёиоӧуӱыэюяАЕЁИОӦУӰЫЭЮЯ]/;

/** Слоги шорского слова: согласный перед гласным начинает слог (э-зен, чат-чаң, қай-де). */
export function syllables(word: string): string[] {
  const ch = [...word];
  const vow = ch.map((c, i) => (VOWELS.test(c) ? i : -1)).filter((i) => i >= 0);
  if (vow.length < 2) return [word];
  const cuts: number[] = [];
  for (let k = 1; k < vow.length; k++) {
    const between = ch.slice(vow[k - 1] + 1, vow[k]).filter((c) => /\p{L}/u.test(c) && !/[ьъЬЪ]/.test(c)).length;
    let cut = vow[k];
    // один согласный уходит к следующему слогу, из нескольких — только последний
    if (between >= 1) {
      cut = vow[k] - 1;
      while (cut > vow[k - 1] && /[ьъЬЪ]/.test(ch[cut])) cut--;
      if (/[ьъЬЪ]/.test(ch[cut + 1] ?? '')) cut++;
    }
    cuts.push(cut);
  }
  const out: string[] = [];
  let start = 0;
  for (const c of cuts) {
    out.push(ch.slice(start, c).join(''));
    start = c;
  }
  out.push(ch.slice(start).join(''));
  return out.filter(Boolean);
}

/** Текст для медленного чтения: короткое — по слогам, длинную фразу — по словам. */
export function slowText(text: string) {
  const words = text.replace(/-/g, ' ').trim().split(/\s+/);
  if (words.length > 2) return words.join(', ');
  return words.map((w) => syllables(w).join(', ')).join('. ');
}

export function canSpeak() {
  return ttsSupported() || urlByText.size > 0 || communityByText.size > 0;
}

/** Произнести шорский текст. Возвращает промис окончания. */
export function speakShor(text: string, opts: { slow?: boolean; force?: boolean } = {}): Promise<void> {
  const st = getState().settings;
  if (!st.tts && !opts.force) return Promise.resolve();
  stopSpeech();
  const key = normalize(text);
  const rec = urlByText.get(key) ?? communityByText.get(key);
  if (rec) {
    return new Promise((resolve) => {
      const a = new Audio(rec);
      current = a;
      a.playbackRate = opts.slow ? 0.7 : 1;
      a.onended = () => resolve();
      // файл недоступен (нет сети) — читаем синтезом
      a.onerror = () => (current === a ? speakTts(text, opts).then(resolve) : resolve());
      a.play().catch(() => resolve());
    });
  }
  return speakTts(text, opts);
}

interface Say {
  text: string;
  voice: SpeechSynthesisVoice | null;
  lang: string;
}

/**
 * Надёжный запуск фразы: пауза после прерывания, повтор потерянной фразы,
 * запасной голос (plain), если нужного языка нет в телефоне.
 */
function speakCore(build: (plain: boolean) => Say, rate: number, pitch = 1): Promise<void> {
  if (!ttsSupported()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    let started = false;
    let tries = 0;
    let plain = false;
    let length = 0;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    const go = () => {
      if (done) return;
      tries++;
      const say = build(plain);
      length = say.text.length;
      const u = new SpeechSynthesisUtterance(say.text);
      if (say.voice) u.voice = say.voice;
      u.lang = say.lang;
      u.rate = rate;
      u.pitch = pitch;
      u.onstart = () => {
        started = true;
      };
      u.onend = fin;
      u.onerror = (ev) => {
        const err = (ev as SpeechSynthesisErrorEvent).error;
        if (!started && tries < 2 && err !== 'interrupted' && err !== 'canceled' && err !== 'not-allowed') {
          plain = true;
          setTimeout(go, 150);
        } else fin();
      };
      try {
        if (speechSynthesis.paused) speechSynthesis.resume();
        speechSynthesis.speak(u);
      } catch {
        fin();
        return;
      }
      // фразу потеряли: движок свободен, а она так и не началась — повторяем один раз (без cancel)
      setTimeout(() => {
        if (done || started || tries >= 2) return;
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          plain = true;
          go();
        }
      }, 2500);
    };
    // сразу после cancel() браузеры теряют новую фразу — даём движку мгновение
    const begin = () => {
      const wait = Math.max(0, cancelledAt + 250 - Date.now());
      if (wait) setTimeout(go, wait);
      else go();
    };
    void voicesReady().then(begin);
    const guard = () => {
      // долгие фразы рассказчика: ждём, пока движок ещё говорит
      if (started && !done && speechSynthesis.speaking) return void setTimeout(guard, 2000);
      if (!started && !done && !issueShown) {
        issueShown = true;
        issueListeners.forEach((l) => l());
      }
      fin();
    };
    setTimeout(guard, Math.max(8000, (Math.max(length, 20) * 180) / rate));
  });
}

function speakTts(text: string, opts: { slow?: boolean }): Promise<void> {
  const st = getState().settings;
  // голоса почти не замедляются ниже ~0,5, поэтому медленно — ещё и по слогам
  const base = opts.slow ? slowText(text) : text;
  const rate = opts.slow ? Math.max(0.5, st.rate * 0.7) : st.rate;
  return speakCore((plain) => {
    const v = plain ? null : pickVoice();
    const lang = v?.lang ?? 'ru-RU';
    return { text: speakable(base, lang), voice: v, lang };
  }, rate);
}

/** Русский голос для рассказчика: лучше «Google»/«Milena», иначе любой русский. */
function ruVoice(): SpeechSynthesisVoice | null {
  const vs = availableVoices().filter((v) => v.lang.toLowerCase().startsWith('ru'));
  return vs.find((v) => /google|milena|yuri|premium|enhanced/i.test(v.name)) ?? vs[0] ?? null;
}

/**
 * Голос рассказчика эпоса: строка пересказа целиком по-русски,
 * шорские слова в скобках читаются тем же голосом (без смены голоса посреди фразы).
 */
export function narrate(line: string): Promise<void> {
  if (!ttsSupported()) return Promise.resolve();
  stopSpeech();
  const clean = line.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  return speakCore((plain) => {
    const v = plain ? null : ruVoice();
    return { text: toRussian(clean), voice: v, lang: v?.lang ?? 'ru-RU' };
  }, 0.95, 0.95);
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
