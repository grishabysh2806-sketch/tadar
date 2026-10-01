/*
 * Синхронизация прогресса и публичных данных ученика.
 * Прогресс целиком (одна строка JSON на человека) — чтобы продолжать
 * на другом устройстве. Профиль, опыт недели в лиге и результаты уроков
 * для учителя — маленькие строки, которые видят другие.
 */
import { getState, replaceState, fromSaved, subscribe, streakNow, type State } from '../state/store';
import { lessonsDone, weekXp } from '../state/game';
import { addDays, dayKey, weekStart } from '../lib/util';
import { api, check, net } from './client';
import { ensureRoom, patchMyXp } from './league';

let lastProgress = '';
let lastProgressAt = 0;
let lastProfile = '';
let lastActive = 0;
const sentXp = new Map<string, number>();
const sentLessons = new Map<string, string>();

/** Только нужное: старые дни календаря и заморозки не храним вечно. */
function compact(s: State): State {
  const cut = addDays(dayKey(), -400);
  const keep = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => k >= cut));
  return { ...s, xpDays: keep(s.xpDays), goalDays: keep(s.goalDays), streak: { ...s.streak, frozen: s.streak.frozen.slice(-60) } };
}

/** Забрать прогресс с сервера: побеждает копия, где больше опыта (при равенстве — более свежая). */
export async function pullProgress() {
  const { sb, uid } = await api();
  const row = check(await sb.from('progress').select('state, xp, updated_at').eq('user_id', uid).maybeSingle()) as {
    state: unknown;
    xp: number;
    updated_at: string;
  } | null;
  if (!row) return;
  const local = getState();
  const remoteAt = Date.parse(row.updated_at) || 0;
  if (row.xp > local.xp || (row.xp === local.xp && remoteAt > local.updatedAt)) {
    const st = fromSaved(row.state);
    lastProgress = JSON.stringify(compact(st));
    lastProgressAt = Date.now();
    replaceState(st);
  } else if (row.xp === local.xp && remoteAt === local.updatedAt) {
    lastProgress = JSON.stringify(compact(local));
  }
}

async function pushProgress() {
  const { sb, uid } = await api();
  const s = getState();
  const st = compact(s);
  const json = JSON.stringify(st);
  if (json === lastProgress) return;
  check(await sb.from('progress').upsert({ user_id: uid, state: st, xp: s.xp, updated_at: new Date(s.updatedAt || Date.now()).toISOString() }));
  lastProgress = json;
  lastProgressAt = Date.now();
}

async function pushProfile() {
  const { sb, uid } = await api();
  const s = getState();
  const p = {
    name: s.profile.name.trim().slice(0, 24),
    avatar: ((s.profile.avatar % 6) + 6) % 6,
    xp_total: Math.max(0, s.xp),
    streak: streakNow(s),
    lessons_done: lessonsDone(s),
    league_tier: s.league.tier,
  };
  const key = JSON.stringify(p);
  if (key === lastProfile && Date.now() - lastActive < 3600_000) return;
  check(await sb.from('profiles').upsert({ id: uid, ...p, last_active: new Date().toISOString() }));
  lastProfile = key;
  lastActive = Date.now();
}

/** Опыт недели в своей группе лиги (в группу попадают после первого опыта за неделю). */
async function pushLeague() {
  const s = getState();
  const xp = weekXp(s);
  const week = weekStart();
  const { sb, uid } = await api();
  const key = uid + ':' + week;
  if (xp <= 0 || sentXp.get(key) === xp) return;
  await ensureRoom();
  check(await sb.from('league_members').update({ xp: Math.min(xp, 100000) }).eq('week', week).eq('user_id', uid));
  sentXp.set(key, xp);
  patchMyXp(uid, xp);
}

/** Результаты уроков нужны учителю — отправляем, только если ученик в классе. */
async function pushLessons() {
  const s = getState();
  if (!s.cls.joined?.id) return;
  const { sb, uid } = await api();
  const rows = Object.entries(s.lessons)
    .filter(([id, l]) => l.done && sentLessons.get(uid + id) !== `${l.best}:${l.times}`)
    .map(([id, l]) => ({ user_id: uid, lesson_id: id.slice(0, 16), best: Math.max(0, Math.min(100, Math.round(l.best))), times: Math.max(1, l.times), last_at: new Date(l.t || Date.now()).toISOString() }));
  if (!rows.length) return;
  check(await sb.from('lesson_results').upsert(rows, { onConflict: 'user_id,lesson_id' }));
  rows.forEach((r) => sentLessons.set(uid + r.lesson_id, `${r.best}:${r.times}`));
}

/* ── Цикл отправки ───────────────────────────────────────────────── */

let timer = 0;
let running = false;
let again = false;
let unsub: (() => void) | null = null;

async function cycle(full = false) {
  if (net.get().status !== 'online') return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    await pushLeague();
    await pushProfile();
    await pushLessons();
    // весь прогресс — не чаще раза в 20 секунд
    const wait = 20000 - (Date.now() - lastProgressAt);
    if (full || wait <= 0) await pushProgress();
    else schedule(wait + 100);
  } catch {
    /* сеть или сервер недоступны — повторим при следующем изменении или подключении */
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(1500);
    }
  }
}

function schedule(ms = 2500) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void cycle(), ms);
}

export function startSync() {
  if (!unsub) unsub = subscribe(() => schedule());
}

export function stopSync() {
  unsub?.();
  unsub = null;
  window.clearTimeout(timer);
  lastProgress = '';
  lastProfile = '';
  lastProgressAt = 0;
  lastActive = 0;
}

/** Отправить всё сейчас (после входа, при уходе со страницы). */
export const syncNow = () => cycle(true);
