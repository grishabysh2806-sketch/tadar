import type { Item, Sentence, Lesson, Unit } from '../data/types';
import { ITEMS, ALL_ITEMS, ruMain } from '../data/vocab';
import { SENTENCES, ALL_SENTENCES } from '../data/sentences';
import { UNITS } from '../data/course';
import { normalize, plain, tokens } from '../lib/text';
import { shuffle } from '../lib/util';
import type { State } from '../state/store';

export type Exercise =
  | { kind: 'intro'; key: string; item: Item }
  | { kind: 'choose_ru'; key: string; item: Item; options: Item[] }
  | { kind: 'choose_shor'; key: string; item: Item; options: Item[] }
  | { kind: 'picture'; key: string; item: Item; options: Item[] }
  | { kind: 'listen'; key: string; item: Item; options: Item[] }
  | { kind: 'match'; key: string; pairs: Item[] }
  | { kind: 'build'; key: string; sentence: Sentence; dir: 'shor2ru' | 'ru2shor'; tiles: string[]; answer: string[] }
  | { kind: 'type'; key: string; item: Item; dir: 'ru2shor' | 'shor2ru' }
  | { kind: 'listen_type'; key: string; item: Item }
  | { kind: 'fill'; key: string; sentence: Sentence; blank: number; options: string[]; answer: string; item: Item };

export type ExerciseKind = Exercise['kind'];

export const KIND_TITLE: Record<ExerciseKind, string> = {
  intro: 'Новое слово',
  choose_ru: 'Выберите перевод',
  choose_shor: 'Как это будет по-шорски?',
  picture: 'Выберите картинку',
  listen: 'Что вы услышали?',
  match: 'Найдите пары',
  build: 'Переведите предложение',
  type: 'Напишите перевод',
  listen_type: 'Напишите, что услышали',
  fill: 'Вставьте пропущенное слово',
};

/* ── Значения и пересечения ───────────────────────────────────── */

const mains = (it: Item) => it.ru.split(';').map((x) => normalize(x)).filter(Boolean);
const full = (it: Item) => [...mains(it), ...(it.alt ?? []).map(normalize)];

/** Слова путаются, если значение одного входит в допустимые значения другого. */
export function overlaps(a: Item, b: Item) {
  if (a.id === b.id) return true;
  if (plain(a.shor) === plain(b.shor)) return true;
  const fa = full(a);
  const fb = full(b);
  return mains(b).some((m) => fa.includes(m)) || mains(a).some((m) => fb.includes(m));
}

export function accepted(it: Item) {
  return [...it.ru.split(';').map((x) => x.trim()), ...(it.alt ?? [])];
}

export const hasPicture = (it: Item) => !!(it.emoji || it.swatch || it.num !== undefined);

function pickDistractors(target: Item, pool: Item[], n: number, filter?: (it: Item) => boolean): Item[] {
  const out: Item[] = [];
  const cands = shuffle(pool).sort((a, b) => Number(b.pos === target.pos) - Number(a.pos === target.pos));
  for (const c of cands) {
    if (out.length >= n) break;
    if (overlaps(c, target)) continue;
    if (filter && !filter(c)) continue;
    if (out.some((o) => overlaps(o, c))) continue;
    out.push(c);
  }
  return out;
}

function unitOf(it: Item): Unit | undefined {
  return UNITS.find((u) => u.lessons.some((l) => l.items.includes(it.id)));
}

/** Пул отвлекающих вариантов: сначала знакомые слова, потом слова раздела, затем любые. */
function poolFor(target: Item, known: Item[]): Item[] {
  const u = unitOf(target);
  const unitItems = u ? u.lessons.flatMap((l) => l.items).map((id) => ITEMS[id]) : [];
  const seen = new Set<string>();
  const res: Item[] = [];
  for (const it of [...known, ...unitItems, ...ALL_ITEMS]) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      res.push(it);
    }
  }
  return res;
}

function options(target: Item, known: Item[], n: number, filter?: (it: Item) => boolean) {
  // берём ближайшие по разделу, но перемешиваем внутри «знакомых»
  const pool = poolFor(target, known);
  const near = pool.slice(0, Math.max(12, known.length + 8));
  let ds = pickDistractors(target, near, n, filter);
  if (ds.length < n) ds = [...ds, ...pickDistractors(target, pool.filter((p) => !ds.includes(p)), n - ds.length, filter)];
  return shuffle([target, ...ds]);
}

function pickMatchSet(items: Item[], extra: Item[], n = 5): Item[] {
  const out: Item[] = [];
  for (const it of [...shuffle(items), ...shuffle(extra)]) {
    if (out.length >= n) break;
    if (out.some((o) => overlaps(o, it))) continue;
    out.push(it);
  }
  return out;
}

/* ── Предложения ─────────────────────────────────────────────── */

function ruDistractorTokens(sentence: Sentence, n: number): string[] {
  const own = new Set(tokens(sentence.ru));
  const pool = shuffle(ALL_SENTENCES.filter((s) => s.id !== sentence.id).flatMap((s) => tokens(s.ru))).filter((t) => !own.has(t) && t.length > 1);
  return [...new Set(pool)].slice(0, n);
}

function shorDistractorTokens(sentence: Sentence, known: Item[], n: number): string[] {
  const own = new Set(tokens(sentence.shor).map(plain));
  const fromItems = shuffle(known)
    .filter((it) => !it.shor.includes(' ') && !it.shor.endsWith('-'))
    .map((it) => it.shor.toLowerCase());
  const fromSent = shuffle(ALL_SENTENCES.filter((s) => s.id !== sentence.id).flatMap((s) => tokens(s.shor)));
  const res: string[] = [];
  for (const t of [...fromItems, ...fromSent]) {
    if (res.length >= n) break;
    if (own.has(plain(t)) || res.includes(t)) continue;
    res.push(t);
  }
  return res;
}

function buildEx(sentence: Sentence, dir: 'shor2ru' | 'ru2shor', known: Item[], key: string): Exercise {
  const answer = tokens(dir === 'shor2ru' ? sentence.ru : sentence.shor);
  const nDistr = Math.min(4, Math.max(2, 7 - answer.length));
  const distr = dir === 'shor2ru' ? ruDistractorTokens(sentence, nDistr) : shorDistractorTokens(sentence, known, nDistr);
  return { kind: 'build', key, sentence, dir, answer, tiles: shuffle([...answer, ...distr]) };
}

function fillEx(sentence: Sentence, lessonItems: Item[], known: Item[], key: string): Exercise | null {
  const toks = sentence.shor.split(/\s+/);
  if (toks.length < 2) return null;
  // ищем слово урока, совпадающее с токеном
  for (let i = 0; i < toks.length; i++) {
    const t = plain(toks[i]);
    const it = [...lessonItems, ...known].find((x) => !x.shor.includes(' ') && plain(x.shor.replace(/-$/, '')) === t);
    if (!it) continue;
    const others = pickDistractors(it, [...lessonItems, ...known, ...poolFor(it, known)], 3, (c) => !c.shor.includes(' ') && !c.shor.endsWith('-')).map((x) =>
      x.shor.toLowerCase(),
    );
    if (others.length < 2) return null;
    const answer = toks[i].replace(/[!?.,:;]/g, '').toLowerCase();
    return { kind: 'fill', key, sentence, blank: i, answer, options: shuffle([answer, ...others]), item: it };
  }
  return null;
}

/* ── Урок ─────────────────────────────────────────────────────── */

export interface GenOptions {
  audio: boolean;
  /** Повтор пройденного урока — без карточек новых слов. */
  replay?: boolean;
}

export function knownItems(s: State): Item[] {
  return ALL_ITEMS.filter((it) => s.items[it.id]?.c);
}

export function generateLesson(lesson: Lesson, s: State, opt: GenOptions): Exercise[] {
  const items = lesson.items.map((id) => ITEMS[id]);
  const sentences = (lesson.sentences ?? []).map((id) => SENTENCES[id]).filter(Boolean);
  const known = knownItems(s).filter((k) => !lesson.items.includes(k.id));
  const globalIdx = UNITS.flatMap((u) => u.lessons).findIndex((l) => l.id === lesson.id);
  const out: Exercise[] = [];
  let k = 0;
  const key = () => `x${k++}`;
  const all = [...items, ...known];

  // 1) Знакомство: карточка → сразу проверка
  items.forEach((it, i) => {
    const fresh = !s.items[it.id] && !opt.replay;
    if (fresh) out.push({ kind: 'intro', key: key(), item: it });
    if (hasPicture(it) && i % 2 === 0) {
      out.push({ kind: 'picture', key: key(), item: it, options: options(it, all, 3, hasPicture) });
    } else {
      out.push({ kind: 'choose_ru', key: key(), item: it, options: options(it, all, 3) });
    }
  });

  // 2) Пары
  const matchSet = pickMatchSet(items, shuffle(known).slice(0, 6), 5);
  if (matchSet.length >= 3) out.push({ kind: 'match', key: key(), pairs: matchSet });

  // 3) Обратный перевод и аудирование
  const shuffled = shuffle(items);
  shuffled.forEach((it, i) => {
    if (opt.audio && i % 2 === 1) out.push({ kind: 'listen', key: key(), item: it, options: options(it, all, 3) });
    else out.push({ kind: 'choose_shor', key: key(), item: it, options: options(it, all, 3) });
  });

  // 4) Предложения
  sentences.forEach((sn, i) => {
    out.push(buildEx(sn, i % 2 === 0 ? 'shor2ru' : 'ru2shor', all, key()));
  });
  if (sentences.length) {
    const f = fillEx(sentences[sentences.length - 1], items, known, key());
    if (f) out.push(f);
    if (sentences.length === 1) out.push(buildEx(sentences[0], 'ru2shor', all, key()));
  }

  // 5) Письмо
  if (globalIdx >= 1) {
    const typeable = shuffle(items.filter((it) => it.shor.length <= 12));
    if (typeable[0]) out.push({ kind: 'type', key: key(), item: typeable[0], dir: 'ru2shor' });
    if (globalIdx >= 4 && typeable[1]) out.push({ kind: 'type', key: key(), item: typeable[1], dir: 'shor2ru' });
    if (opt.audio && globalIdx >= 6 && typeable[2]) out.push({ kind: 'listen_type', key: key(), item: typeable[2] });
  }

  // 6) Повторение старого
  const review = shuffle(known).slice(0, globalIdx >= 2 ? 2 : 0);
  review.forEach((it, i) =>
    out.push(
      i % 2 === 0
        ? { kind: 'choose_ru', key: key(), item: it, options: options(it, all, 3) }
        : { kind: 'choose_shor', key: key(), item: it, options: options(it, all, 3) },
    ),
  );

  // ограничиваем длину: знакомство со словами и «разнообразные» задания остаются,
  // а лишние выборы из вариантов отбрасываются
  const MAX = 20;
  const headLen = out.findIndex((e) => e.kind === 'match' || e.kind === 'choose_shor' || e.kind === 'listen');
  const head = headLen < 0 ? out : out.slice(0, headLen);
  const tail = headLen < 0 ? [] : out.slice(headLen);
  if (head.length + tail.length <= MAX) return out;
  const keep = tail.filter((e) => KEEP.includes(e.kind));
  const fillers = tail.filter((e) => !KEEP.includes(e.kind));
  const room = Math.max(2, MAX - head.length - keep.length);
  const chosen = new Set([...keep, ...fillers.slice(0, room)]);
  return [...head, ...tail.filter((e) => chosen.has(e))];
}

const KEEP: ExerciseKind[] = ['match', 'build', 'fill', 'type', 'listen_type'];

/** Тренировка слабых слов. */
export function generatePractice(itemIds: string[], s: State, opt: GenOptions): Exercise[] {
  const items = itemIds.map((id) => ITEMS[id]).filter(Boolean);
  const known = knownItems(s);
  const out: Exercise[] = [];
  let k = 0;
  const key = () => `p${k++}`;
  const match = pickMatchSet(items, known, 5);
  items.forEach((it, i) => {
    const r = i % 4;
    if (r === 0) out.push({ kind: 'choose_ru', key: key(), item: it, options: options(it, known, 3) });
    else if (r === 1) out.push(opt.audio ? { kind: 'listen', key: key(), item: it, options: options(it, known, 3) } : { kind: 'choose_shor', key: key(), item: it, options: options(it, known, 3) });
    else if (r === 2) out.push({ kind: 'choose_shor', key: key(), item: it, options: options(it, known, 3) });
    else out.push({ kind: 'type', key: key(), item: it, dir: it.shor.length <= 12 ? 'ru2shor' : 'shor2ru' });
    if (i === 2 && match.length >= 3) out.push({ kind: 'match', key: key(), pairs: match });
  });
  // предложение из пройденного
  const learnedSentences = ALL_SENTENCES.filter((sn) =>
    UNITS.some((u) => u.lessons.some((l) => s.lessons[l.id]?.done && l.sentences?.includes(sn.id))),
  );
  const sn = shuffle(learnedSentences)[0];
  if (sn) out.push(buildEx(sn, Math.random() < 0.5 ? 'shor2ru' : 'ru2shor', known, key()));
  return out;
}

/** Какие слова проверяет упражнение (для статистики запоминания). */
export function exerciseItems(e: Exercise): string[] {
  switch (e.kind) {
    case 'match':
      return e.pairs.map((p) => p.id);
    case 'build':
      return [];
    case 'fill':
      return [e.item.id];
    case 'intro':
      return [];
    default:
      return [e.item.id];
  }
}

export const ruOf = ruMain;
