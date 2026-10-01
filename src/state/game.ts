import { UNITS, LESSONS } from '../data/course';
import { EPICS } from '../data/epics';
import { ALL_ITEMS } from '../data/vocab';
import type { Unit, Lesson } from '../data/types';
import { getState, setState, heartsNow, MAX_HEARTS, HEART_MS, type State } from './store';
import { dayKey, addDays, daysBetween, rng, shuffle, weekStart, hashStr, DAY } from '../lib/util';

/* ── Путь ─────────────────────────────────────────────────────── */

export interface PathNode {
  key: string;
  kind: 'lesson' | 'chest' | 'epic';
  unit: Unit;
  lesson?: Lesson;
  lessonIndex?: number;
}

export function unitNodes(u: Unit): PathNode[] {
  const nodes: PathNode[] = [];
  u.lessons.forEach((l, i) => {
    nodes.push({ key: l.id, kind: 'lesson', unit: u, lesson: l, lessonIndex: i });
    if (i === 1) nodes.push({ key: u.id + '-chest', kind: 'chest', unit: u });
  });
  nodes.push({ key: u.id + '-epic', kind: 'epic', unit: u });
  return nodes;
}

export type NodeStatus = 'locked' | 'current' | 'done' | 'available';

export function currentLessonId(s: State): string | null {
  const l = LESSONS.find((x) => !s.lessons[x.lesson.id]?.done);
  return l ? l.lesson.id : null;
}

export function isLessonUnlocked(s: State, lessonId: string) {
  const idx = LESSONS.findIndex((x) => x.lesson.id === lessonId);
  if (idx <= 0) return true;
  return !!s.lessons[LESSONS[idx - 1].lesson.id]?.done || !!s.lessons[lessonId]?.done;
}

export function unitDone(s: State, u: Unit) {
  return u.lessons.every((l) => s.lessons[l.id]?.done);
}

export function nodeStatus(s: State, n: PathNode, current: string | null): NodeStatus {
  if (n.kind === 'lesson') {
    const id = n.lesson!.id;
    if (s.lessons[id]?.done) return 'done';
    if (id === current) return 'current';
    return 'locked';
  }
  if (n.kind === 'chest') {
    if (s.chests[n.key]) return 'done';
    return s.lessons[n.unit.lessons[1].id]?.done ? 'available' : 'locked';
  }
  if (s.epics[n.unit.epicId]) return 'done';
  return unitDone(s, n.unit) ? 'available' : 'locked';
}

export function unitProgress(s: State, u: Unit) {
  const done = u.lessons.filter((l) => s.lessons[l.id]?.done).length;
  return { done, total: u.lessons.length };
}

export const learnedCount = (s: State) => Object.values(s.items).filter((x) => x.c > 0).length;
export const lessonsDone = (s: State) => Object.values(s.lessons).filter((x) => x.done).length;

/* ── Опыт, серия, цель ───────────────────────────────────────── */

function addXp(d: State, amount: number) {
  const today = dayKey();
  d.xp += amount;
  d.xpDays[today] = (d.xpDays[today] ?? 0) + amount;
  bumpQuest(d, 'xp', amount);
}

function boostOn(d: State) {
  return d.boost.xp2Until > Date.now();
}

/** Отмечает активность сегодня. Возвращает, выросла ли серия. */
function touchStreak(d: State): { before: number; after: number; extended: boolean } {
  const today = dayKey();
  const st = d.streak;
  const before = st.last === today ? st.cur : streakAlive(d, today) ? st.cur : 0;
  if (st.last === today) return { before, after: st.cur, extended: false };
  if (!st.last) {
    st.cur = 1;
  } else {
    const gap = daysBetween(st.last, today);
    if (gap === 1) st.cur += 1;
    else if (gap > 1 && gap - 1 <= st.freezes) {
      for (let i = 1; i < gap; i++) st.frozen.push(addDays(st.last, i));
      st.freezes -= gap - 1;
      st.cur += 1;
    } else st.cur = 1;
  }
  st.last = today;
  st.best = Math.max(st.best, st.cur);
  return { before, after: st.cur, extended: true };
}

function streakAlive(d: State, today: string) {
  if (!d.streak.last) return false;
  const gap = daysBetween(d.streak.last, today);
  return gap <= 1 || gap - 1 <= d.streak.freezes;
}

function checkGoal(d: State): boolean {
  const today = dayKey();
  if (d.goalDays[today]) return false;
  if ((d.xpDays[today] ?? 0) >= d.settings.goal) {
    d.goalDays[today] = true;
    d.nuts += 5;
    return true;
  }
  return false;
}

/* ── Сердца ───────────────────────────────────────────────────── */

function commitHearts(d: State, now = Date.now()) {
  const h = heartsNow(d, now);
  if (h >= MAX_HEARTS) {
    d.hearts = MAX_HEARTS;
    d.heartsAt = now;
  } else {
    const used = Math.floor((now - d.heartsAt) / HEART_MS);
    d.hearts = h;
    d.heartsAt = d.heartsAt + used * HEART_MS;
  }
}

export function loseHeart() {
  setState((d) => {
    if (!d.settings.hearts) return;
    commitHearts(d);
    if (d.hearts >= MAX_HEARTS) d.heartsAt = Date.now();
    d.hearts = Math.max(0, d.hearts - 1);
  });
}

export function gainHeart(n = 1) {
  setState((d) => {
    commitHearts(d);
    d.hearts = Math.min(MAX_HEARTS, d.hearts + n);
    if (d.hearts >= MAX_HEARTS) d.heartsAt = Date.now();
  });
}

/* ── Слова ────────────────────────────────────────────────────── */

export function recordAnswer(itemIds: string[], correct: boolean) {
  if (!itemIds.length) return;
  setState((d) => {
    const now = Date.now();
    for (const id of itemIds) {
      const st = d.items[id] ?? { s: 0, c: 0, w: 0, t: now };
      if (correct) {
        st.c += 1;
        st.s = Math.min(5, st.s + 1);
      } else {
        st.w += 1;
        st.s = Math.max(0, st.s - 2);
      }
      st.t = now;
      d.items[id] = st;
    }
  });
}

/** Эффективная прочность с учётом забывания. */
export function strength(s: State, id: string, now = Date.now()) {
  const st = s.items[id];
  if (!st) return 0;
  const days = (now - st.t) / DAY;
  return Math.max(0, st.s - days / 3);
}

export function weakItems(s: State, n: number): string[] {
  const learned = ALL_ITEMS.filter((it) => s.items[it.id]?.c);
  return learned
    .map((it) => ({ id: it.id, k: strength(s, it.id) + Math.random() * 0.8 }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((x) => x.id);
}

/* ── Завершение урока ─────────────────────────────────────────── */

export interface LessonResult {
  kind: 'lesson' | 'practice';
  lessonId?: string;
  correct: number;
  total: number;
  mistakes: number;
  bestCombo: number;
  ms: number;
}

export interface LessonSummary {
  xp: number;
  nuts: number;
  accuracy: number;
  ms: number;
  streakBefore: number;
  streakAfter: number;
  streakExtended: boolean;
  goalReached: boolean;
  firstTime: boolean;
  heartsGained: number;
  achievements: string[];
  quests: string[];
  unitCompleted?: string;
  boosted: boolean;
}

export function completeLesson(r: LessonResult): LessonSummary {
  let summary!: LessonSummary;
  setState((d) => {
    ensureQuests(d);
    const questsBefore = completedQuestIds(d);
    const achBefore = new Set(Object.keys(d.ach));
    const accuracy = r.total ? r.correct / r.total : 1;
    const perfect = r.mistakes === 0 && r.total >= 5;
    const first = r.kind === 'lesson' && !!r.lessonId && !d.lessons[r.lessonId]?.done;
    let xp: number;
    let nuts: number;
    if (r.kind === 'practice') {
      xp = 8 + (perfect ? 2 : 0);
      nuts = 3;
    } else if (first) {
      xp = 10 + (perfect ? 5 : 0) + (r.bestCombo >= 8 ? 2 : 0);
      nuts = 5 + (perfect ? 5 : 0);
    } else {
      xp = 5 + (perfect ? 2 : 0);
      nuts = 2;
    }
    const boosted = boostOn(d);
    if (boosted) xp *= 2;
    addXp(d, xp);
    d.nuts += nuts;
    let heartsGained = 0;
    if (r.kind === 'practice' && d.settings.hearts) {
      commitHearts(d);
      if (d.hearts < MAX_HEARTS) {
        d.hearts += 1;
        heartsGained = 1;
      }
    }
    let unitCompleted: string | undefined;
    if (r.lessonId) {
      const ls = d.lessons[r.lessonId] ?? { done: false, best: 0, times: 0, t: 0 };
      ls.done = ls.done || r.kind === 'lesson';
      ls.best = Math.max(ls.best, Math.round(accuracy * 100));
      ls.times += 1;
      ls.t = Date.now();
      d.lessons[r.lessonId] = ls;
      if (first) {
        const u = UNITS.find((u) => u.lessons.some((l) => l.id === r.lessonId));
        if (u && unitDone(d, u)) unitCompleted = u.id;
      }
    }
    d.stats.lessons += 1;
    if (r.kind === 'practice') d.stats.practice += 1;
    if (perfect) d.stats.perfect += 1;
    d.stats.bestCombo = Math.max(d.stats.bestCombo, r.bestCombo);
    d.stats.ms += r.ms;
    const st = touchStreak(d);
    const goalReached = checkGoal(d);
    bumpQuest(d, 'lesson', 1);
    bumpQuestMax(d, 'combo', r.bestCombo);
    if (perfect) bumpQuest(d, 'perfect', 1);
    if (accuracy >= 0.9) bumpQuest(d, 'acc90', 1);
    const hour = new Date().getHours();
    if (hour < 8) grant(d, 'early');
    if (hour >= 22) grant(d, 'night');
    checkAchievements(d);
    summary = {
      xp,
      nuts,
      accuracy,
      ms: r.ms,
      streakBefore: st.before,
      streakAfter: st.after,
      streakExtended: st.extended,
      goalReached,
      firstTime: first,
      heartsGained,
      achievements: Object.keys(d.ach).filter((k) => !achBefore.has(k)),
      quests: completedQuestIds(d).filter((q) => !questsBefore.includes(q)),
      unitCompleted,
      boosted,
    };
  });
  return summary;
}

/* ── Сундуки и эпос ──────────────────────────────────────────── */

export function openChest(key: string): number {
  const amount = 15 + Math.floor(rng(key)() * 21);
  setState((d) => {
    if (d.chests[key]) return;
    d.chests[key] = true;
    d.nuts += amount;
    checkAchievements(d);
  });
  return amount;
}

export function claimEpic(unitId: string): { xp: number } {
  const u = UNITS.find((x) => x.id === unitId)!;
  let xp = 50;
  setState((d) => {
    if (d.epics[u.epicId]) {
      xp = 0;
      return;
    }
    d.epics[u.epicId] = { unlocked: Date.now(), plays: 0 };
    addXp(d, xp);
    d.nuts += 20;
    touchStreak(d);
    checkGoal(d);
    checkAchievements(d);
  });
  return { xp };
}

export function markEpicPlayed(epicId: string) {
  setState((d) => {
    const e = d.epics[epicId] ?? { unlocked: Date.now(), plays: 0 };
    e.plays += 1;
    d.epics[epicId] = e;
    d.stats.epicPlays += 1;
    ensureQuests(d);
    bumpQuest(d, 'epic', 1);
    checkAchievements(d);
  });
}

/* ── Магазин ─────────────────────────────────────────────────── */

export const SHOP = {
  freeze: { price: 200, title: 'Заморозка серии', desc: 'Сохранит серию, если вы пропустите день. Можно запастись двумя.', icon: 'freeze' },
  hearts: { price: 350, title: 'Восстановить сердца', desc: 'Все пять сердец — сразу, без ожидания.', icon: 'heart' },
  boost: { price: 100, title: 'Двойной опыт', desc: '15 минут весь опыт за уроки удваивается.', icon: 'bolt' },
} as const;
export type ShopKey = keyof typeof SHOP;

export function canBuy(s: State, key: ShopKey): { ok: boolean; reason?: string } {
  const item = SHOP[key];
  if (s.nuts < item.price) return { ok: false, reason: 'Не хватает орешков' };
  if (key === 'freeze' && s.streak.freezes >= 2) return { ok: false, reason: 'Уже есть две заморозки' };
  if (key === 'hearts' && heartsNow(s) >= MAX_HEARTS) return { ok: false, reason: 'Сердца и так полные' };
  if (key === 'hearts' && !s.settings.hearts) return { ok: false, reason: 'Сердца отключены в настройках' };
  if (key === 'boost' && s.boost.xp2Until > Date.now()) return { ok: false, reason: 'Уже действует' };
  return { ok: true };
}

export function buy(key: ShopKey) {
  setState((d) => {
    if (!canBuy(d, key).ok) return;
    d.nuts -= SHOP[key].price;
    if (key === 'freeze') d.streak.freezes += 1;
    if (key === 'hearts') {
      d.hearts = MAX_HEARTS;
      d.heartsAt = Date.now();
    }
    if (key === 'boost') d.boost.xp2Until = Date.now() + 15 * 60 * 1000;
  });
}

/* ── Задания дня ─────────────────────────────────────────────── */

export type QuestType = 'xp' | 'lesson' | 'combo' | 'perfect' | 'epic' | 'record' | 'listen' | 'acc90';
export interface QuestDef {
  id: string;
  title: string;
  type: QuestType;
  target: number;
  reward: number;
  icon: string;
}
export const QUEST_POOL: QuestDef[] = [
  { id: 'xp20', title: 'Заработайте 20 опыта', type: 'xp', target: 20, reward: 10, icon: 'bolt' },
  { id: 'xp40', title: 'Заработайте 40 опыта', type: 'xp', target: 40, reward: 20, icon: 'bolt' },
  { id: 'les2', title: 'Пройдите 2 урока', type: 'lesson', target: 2, reward: 15, icon: 'book' },
  { id: 'les3', title: 'Пройдите 3 урока', type: 'lesson', target: 3, reward: 20, icon: 'book' },
  { id: 'combo8', title: 'Ответьте верно 8 раз подряд', type: 'combo', target: 8, reward: 15, icon: 'target' },
  { id: 'perfect', title: 'Пройдите урок без ошибок', type: 'perfect', target: 1, reward: 20, icon: 'gem' },
  { id: 'acc90', title: 'Урок с точностью от 90%', type: 'acc90', target: 1, reward: 15, icon: 'target' },
  { id: 'epic', title: 'Послушайте фрагмент эпоса', type: 'epic', target: 1, reward: 10, icon: 'kai' },
  { id: 'record', title: 'Запишите слово в «Голосах старших»', type: 'record', target: 1, reward: 15, icon: 'mic' },
  { id: 'listen5', title: 'Прослушайте 5 слов в словаре', type: 'listen', target: 5, reward: 10, icon: 'speaker' },
];

export function ensureQuests(d: State) {
  const today = dayKey();
  if (d.quests.day === today && d.quests.ids.length) return;
  const r = rng('q' + today);
  const xpQuest = d.settings.goal >= 30 ? 'xp40' : 'xp20';
  const hasEpic = Object.keys(d.epics).length > 0;
  const pool = QUEST_POOL.filter((q) => q.type !== 'xp' && (q.type !== 'epic' || hasEpic));
  const others = shuffle(pool, r).filter((q, i, arr) => arr.findIndex((x) => x.type === q.type) === i).slice(0, 2);
  d.quests = { day: today, ids: [xpQuest, ...others.map((q) => q.id)], progress: {}, claimed: {} };
}

export function questDef(id: string) {
  return QUEST_POOL.find((q) => q.id === id)!;
}

function bumpQuest(d: State, type: QuestType, amount: number) {
  if (d.quests.day !== dayKey()) return;
  for (const id of d.quests.ids) {
    const q = questDef(id);
    if (q?.type === type) d.quests.progress[id] = Math.min(q.target, (d.quests.progress[id] ?? 0) + amount);
  }
}
function bumpQuestMax(d: State, type: QuestType, value: number) {
  if (d.quests.day !== dayKey()) return;
  for (const id of d.quests.ids) {
    const q = questDef(id);
    if (q?.type === type) d.quests.progress[id] = Math.min(q.target, Math.max(d.quests.progress[id] ?? 0, value));
  }
}
function completedQuestIds(d: State) {
  return d.quests.ids.filter((id) => (d.quests.progress[id] ?? 0) >= questDef(id).target);
}

export function questEvent(type: QuestType, amount = 1) {
  setState((d) => {
    ensureQuests(d);
    bumpQuest(d, type, amount);
    if (type === 'record') d.stats.records += amount;
    checkAchievements(d);
  });
}

export function claimQuest(id: string): number {
  let reward = 0;
  setState((d) => {
    const q = questDef(id);
    if (!q || d.quests.claimed[id] || (d.quests.progress[id] ?? 0) < q.target) return;
    d.quests.claimed[id] = true;
    d.nuts += q.reward;
    reward = q.reward;
  });
  return reward;
}

export function refreshQuests() {
  setState((d) => ensureQuests(d));
}

/* ── Достижения ───────────────────────────────────────────────── */

export interface AchDef {
  id: string;
  icon: string;
  title: string;
  desc: string;
  check?: (s: State) => boolean;
}
const allEpicsUnits = () => UNITS.length;
export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first', icon: '🌱', title: 'Эзен!', desc: 'Пройдите первый урок', check: (s) => s.stats.lessons >= 1 },
  { id: 'streak3', icon: '🔥', title: 'Огонёк', desc: 'Серия 3 дня подряд', check: (s) => s.streak.best >= 3 },
  { id: 'streak7', icon: '🏕️', title: 'Костёр кайчи', desc: 'Серия 7 дней подряд', check: (s) => s.streak.best >= 7 },
  { id: 'streak30', icon: '🌋', title: 'Негасимый очаг', desc: 'Серия 30 дней подряд', check: (s) => s.streak.best >= 30 },
  { id: 'perfect', icon: '💎', title: 'Без единой ошибки', desc: 'Пройдите урок без ошибок', check: (s) => s.stats.perfect >= 1 },
  { id: 'combo15', icon: '⚡', title: 'Комбо', desc: '15 верных ответов подряд', check: (s) => s.stats.bestCombo >= 15 },
  { id: 'unit1', icon: '👋', title: 'Эзеноқтар!', desc: 'Пройдите раздел «Знакомство»', check: (s) => unitDone(s, UNITS[0]) },
  { id: 'taiga', icon: '🌲', title: 'Знаток тайги', desc: 'Пройдите раздел «Тайга»', check: (s) => unitDone(s, UNITS[2]) },
  { id: 'words50', icon: '📗', title: 'Полсотни слов', desc: 'Выучите 50 слов', check: (s) => learnedCount(s) >= 50 },
  { id: 'words150', icon: '📚', title: 'Знаток языка', desc: 'Выучите 150 слов', check: (s) => learnedCount(s) >= 150 },
  { id: 'epic3', icon: '🪕', title: 'Слушатель кая', desc: 'Откройте 3 фрагмента эпоса', check: (s) => Object.keys(s.epics).length >= 3 },
  { id: 'epicAll', icon: '📜', title: 'Хранитель сказаний', desc: 'Откройте все фрагменты эпоса', check: (s) => Object.keys(s.epics).length >= allEpicsUnits() },
  { id: 'voice1', icon: '🎙️', title: 'Голос рода', desc: 'Сделайте первую запись в «Голосах старших»', check: (s) => s.stats.records >= 1 },
  { id: 'voice10', icon: '📻', title: 'Хранитель голосов', desc: 'Сделайте 10 записей', check: (s) => s.stats.records >= 10 },
  { id: 'travel5', icon: '🧭', title: 'Путешественник', desc: 'Откройте 5 мест на карте Шории', check: (s) => s.travel.visited.length >= 5 },
  { id: 'class', icon: '🏫', title: 'Одноклассник', desc: 'Создайте класс или вступите в него', check: (s) => !!s.cls.myClass || !!s.cls.joined },
  { id: 'xp1000', icon: '⭐', title: 'Тысяча', desc: 'Наберите 1000 опыта', check: (s) => s.xp >= 1000 },
  { id: 'alyp', icon: '🛡️', title: 'Алып', desc: 'Пройдите весь курс', check: (s) => LESSONS.every((l) => s.lessons[l.lesson.id]?.done) },
  { id: 'early', icon: '🌅', title: 'Ранняя пташка', desc: 'Пройдите урок до 8 утра' },
  { id: 'night', icon: '🦉', title: 'Ночная сова', desc: 'Пройдите урок после 22:00' },
];

function grant(d: State, id: string) {
  if (!d.ach[id]) d.ach[id] = Date.now();
}

export function checkAchievements(d: State) {
  for (const a of ACHIEVEMENTS) if (a.check && !d.ach[a.id] && a.check(d)) grant(d, a.id);
}

/** Для действий вне уроков: возвращает новые достижения. */
export function runAchievementCheck(): string[] {
  const before = new Set(Object.keys(getState().ach));
  setState((d) => checkAchievements(d));
  return Object.keys(getState().ach).filter((k) => !before.has(k));
}

/* ── Лига ─────────────────────────────────────────────────────── */

export const LEAGUES = [
  { name: 'Қузуқ', ru: 'Лига Ореха', color: '#B7793E', ink: '#fff' },
  { name: 'Таш', ru: 'Лига Камня', color: '#8C9BAB', ink: '#fff' },
  { name: 'Тебир', ru: 'Лига Железа', color: '#56677A', ink: '#fff' },
  { name: 'Кӱмӱш', ru: 'Лига Серебра', color: '#A9B8C9', ink: '#0B2340' },
  { name: 'Алтын', ru: 'Лига Золота', color: '#F8B818', ink: '#3B2A00' },
  { name: 'Алып', ru: 'Лига Богатырей', color: '#139FE0', ink: '#fff' },
];

const BOT_NAMES = [
  'Айана', 'Тимур К.', 'Лиза', 'Артём_2010', 'Аяна Ч.', 'Вика М.', 'Санжар', 'Олег Т.', 'Мария', 'Даша_Тайга',
  'Ильяс', 'Полина К.', 'Никита', 'Алина', 'Сергей Ш.', 'Егор_Шерегеш', 'Ксюша', 'Таня Т.', 'Роман', 'Ульяна',
  'Миша_Кузбасс', 'Айдар', 'Настя', 'Кирилл', 'Женя_Мыски', 'Арина', 'Глеб', 'Света К.', 'Вадим', 'Лена',
  'Тагир', 'Соня', 'Дима_Таштагол', 'Карина', 'Максим', 'Яна',
];

export interface BoardRow {
  name: string;
  xp: number;
  me?: boolean;
  avatar: number;
}

export function weekXp(s: State, week = weekStart()) {
  let sum = 0;
  for (const [k, v] of Object.entries(s.xpDays)) if (k >= week && daysBetween(week, k) < 7) sum += v;
  return sum;
}

export function leagueBoard(s: State, week = weekStart(), tier = s.league.tier, progress?: number): BoardRow[] {
  const r = rng(`league-${week}-${tier}`);
  const names = shuffle(BOT_NAMES, r).slice(0, 19);
  const start = new Date(week + 'T00:00:00').getTime();
  const p = progress ?? Math.min(1, Math.max(0, (Date.now() - start) / (7 * DAY)));
  const mult = 1 + tier * 0.4;
  const rows: BoardRow[] = names.map((name, i) => {
    const total = Math.round((20 + r() * r() * 520) * mult);
    const k = 0.55 + r() * 1.2;
    const xp = Math.round((total * Math.pow(p, k)) / 5) * 5;
    return { name, xp, avatar: (hashStr(name) + i) % 6 };
  });
  rows.push({ name: s.profile.name || 'Вы', xp: weekXp(s, week), me: true, avatar: s.profile.avatar });
  return rows.sort((a, b) => b.xp - a.xp || (a.me ? -1 : 1));
}

/** Подводит итоги прошлой недели лиги (повышение/понижение). */
export function settleLeague() {
  const s = getState();
  const now = weekStart();
  if (s.league.week === now) return;
  setState((d) => {
    if (d.league.week && d.league.week < now) {
      const board = leagueBoard(d, d.league.week, d.league.tier, 1);
      const rank = board.findIndex((x) => x.me) + 1;
      const myXp = board[rank - 1].xp;
      const from = d.league.tier;
      let to = from;
      if (myXp > 0 && rank <= 5) to = Math.min(LEAGUES.length - 1, from + 1);
      else if (rank >= 16 && from > 0) to = from - 1;
      d.league.tier = to;
      if (myXp > 0) d.league.result = { week: d.league.week, rank, from, to, seen: false };
    }
    d.league.week = now;
  });
}

/* ── Режимы ───────────────────────────────────────────────────── */

export function practiceAvailable(s: State) {
  return learnedCount(s) >= 4;
}

export const EPIC_IDS = EPICS.map((e) => e.id);
