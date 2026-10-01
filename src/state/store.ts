import { useSyncExternalStore } from 'react';
import { storage, dayKey, daysBetween } from '../lib/util';

export type Mode = 'learner' | 'class' | 'traveler';
export type Theme = 'system' | 'light' | 'dark';

export interface ItemStat {
  /** Прочность запоминания 0…5. */
  s: number;
  c: number;
  w: number;
  t: number;
}
export interface LessonStat {
  done: boolean;
  best: number;
  times: number;
  t: number;
}
export interface QuestDay {
  day: string;
  ids: string[];
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
}
export interface Assignment {
  id: string;
  lessonId: string;
  due: string;
  createdAt: number;
}
export interface ClassRoom {
  name: string;
  school: string;
  code: string;
  createdAt: number;
  assignments: Assignment[];
}

export interface State {
  v: 1;
  /** Время последнего изменения — для синхронизации между устройствами. */
  updatedAt: number;
  profile: { name: string; since: number; avatar: number; motivation?: string };
  settings: {
    sfx: boolean;
    tts: boolean;
    voice: string;
    rate: number;
    autoplay: boolean;
    hearts: boolean;
    theme: Theme;
    goal: number;
    mode: Mode;
    onboarded: boolean;
    music: boolean;
  };
  xp: number;
  xpDays: Record<string, number>;
  nuts: number;
  hearts: number;
  heartsAt: number;
  streak: { cur: number; best: number; last?: string; freezes: number; frozen: string[] };
  lessons: Record<string, LessonStat>;
  items: Record<string, ItemStat>;
  chests: Record<string, boolean>;
  epics: Record<string, { unlocked: number; plays: number }>;
  quests: QuestDay;
  ach: Record<string, number>;
  league: { tier: number; week: string; result?: { week: string; rank: number; from: number; to: number; seen: boolean } };
  boost: { xp2Until: number };
  cls: {
    role?: 'teacher' | 'student';
    myClass?: ClassRoom;
    joined?: { code: string; name: string; teacher: string; joinedAt: number; assignments: Assignment[] };
  };
  travel: { visited: string[] };
  stats: { lessons: number; perfect: number; bestCombo: number; epicPlays: number; records: number; practice: number; ms: number };
  goalDays: Record<string, boolean>;
}

export const MAX_HEARTS = 5;
export const HEART_MS = 30 * 60 * 1000;
const KEY = 'tadar.state.v1';

export function defaultState(): State {
  return {
    v: 1,
    updatedAt: 0,
    profile: { name: '', since: Date.now(), avatar: Math.floor(Math.random() * 6) },
    settings: {
      sfx: true,
      tts: true,
      voice: '',
      rate: 0.85,
      autoplay: true,
      hearts: true,
      theme: 'system',
      goal: 20,
      mode: 'learner',
      onboarded: false,
      music: true,
    },
    xp: 0,
    xpDays: {},
    nuts: 50,
    hearts: MAX_HEARTS,
    heartsAt: Date.now(),
    streak: { cur: 0, best: 0, freezes: 0, frozen: [] },
    lessons: {},
    items: {},
    chests: {},
    epics: {},
    quests: { day: '', ids: [], progress: {}, claimed: {} },
    ach: {},
    league: { tier: 0, week: '' },
    boost: { xp2Until: 0 },
    cls: {},
    travel: { visited: [] },
    stats: { lessons: 0, perfect: 0, bestCombo: 0, epicPlays: 0, records: 0, practice: 0, ms: 0 },
    goalDays: {},
  };
}

function merge<T>(base: T, saved: unknown): T {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return (saved as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v) ? merge(b, v) : v;
  }
  return out as T;
}

function load(): State {
  const saved = storage.get<Partial<State> | null>(KEY, null);
  if (!saved) return defaultState();
  return merge(defaultState(), saved);
}

/** Состояние из сохранённой копии (например, из облака) с новыми полями по умолчанию. */
export function fromSaved(saved: unknown): State {
  return merge(defaultState(), saved);
}

let state: State = load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => storage.set(KEY, state), 250);
}
window.addEventListener('beforeunload', () => storage.set(KEY, state));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') storage.set(KEY, state);
});

export function getState() {
  return state;
}

/** Изменение состояния: функция получает копию и может её мутировать. */
export function setState(fn: (draft: State) => void) {
  const draft = structuredClone(state);
  fn(draft);
  draft.updatedAt = Date.now();
  state = draft;
  scheduleSave();
  listeners.forEach((l) => l());
}

export function replaceState(next: State) {
  state = next;
  storage.set(KEY, state);
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

/* ── Производные значения ─────────────────────────────────────── */

export function heartsNow(s: State, now = Date.now()) {
  if (!s.settings.hearts) return MAX_HEARTS;
  if (s.hearts >= MAX_HEARTS) return MAX_HEARTS;
  const add = Math.floor((now - s.heartsAt) / HEART_MS);
  return Math.min(MAX_HEARTS, s.hearts + add);
}

export function nextHeartIn(s: State, now = Date.now()) {
  if (heartsNow(s, now) >= MAX_HEARTS) return 0;
  const elapsed = (now - s.heartsAt) % HEART_MS;
  return HEART_MS - elapsed;
}

/** Текущая серия с учётом пропусков (без изменения состояния). */
export function streakNow(s: State, today = dayKey()): number {
  const last = s.streak.last;
  if (!last) return 0;
  if (last === today) return s.streak.cur;
  const d = daysBetween(last, today);
  if (d === 1) return s.streak.cur;
  if (d - 1 <= s.streak.freezes) return s.streak.cur;
  return 0;
}

export const xpToday = (s: State) => s.xpDays[dayKey()] ?? 0;
export const isLessonDone = (s: State, id: string) => !!s.lessons[id]?.done;
