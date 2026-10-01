/*
 * Недельная лига с настоящими учениками.
 * Неделя (с понедельника) → лига → группа до 30 человек. В группу попадают
 * после первого опыта за неделю. Таблица обновляется у всех сразу (Realtime),
 * а в понедельник каждый подводит итоги своей прошлой группы.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getState, setState } from '../state/store';
import { applyLeagueResult, weekXp } from '../state/game';
import { weekStart } from '../lib/util';
import { api, check, getClient, store } from './client';

export interface LeagueRow {
  id: string;
  name: string;
  avatar: number;
  xp: number;
}

export const leagueNet = store<{ week: string; room: string | null; rows: LeagueRow[]; at: number; loading: boolean; live: boolean; error: boolean }>({
  week: '',
  room: null,
  rows: [],
  at: 0,
  loading: false,
  live: false,
  error: false,
});

const rooms = new Map<string, string>();

/** Итоги прошлой недели по реальной группе: место → повышение или понижение. */
export async function settleOnline() {
  const now = weekStart();
  const s = getState();
  if (s.league.week === now) return;
  const prev = s.league.week;
  let result: { rank: number; size: number; xp: number } | null = null;
  if (prev) {
    const { sb, uid } = await api();
    const mine = check(await sb.from('league_members').select('room, xp').eq('week', prev).eq('user_id', uid).maybeSingle()) as { room: string; xp: number } | null;
    if (mine) {
      const rows = check(await sb.from('league_members').select('user_id, xp').eq('room', mine.room).order('xp', { ascending: false }).order('updated_at', { ascending: true })) as {
        user_id: string;
        xp: number;
      }[];
      result = { rank: rows.findIndex((r) => r.user_id === uid) + 1, size: rows.length, xp: mine.xp };
    }
  }
  setState((d) => {
    if (d.league.week !== prev) return;
    applyLeagueResult(d, result);
    d.league.week = now;
  });
}

/** Группа этой недели (вступаем, если ещё не там). */
export async function ensureRoom(): Promise<string> {
  const { sb, uid } = await api();
  await settleOnline();
  const week = weekStart();
  const key = uid + ':' + week;
  let room = rooms.get(key);
  if (!room) {
    room = check(await sb.rpc('league_join', { p_week: week, p_tier: getState().league.tier })) as string;
    rooms.set(key, room);
  }
  return room;
}

const sortRows = (rows: LeagueRow[]) => rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name, 'ru'));

export async function loadBoard() {
  const week = weekStart();
  if (weekXp(getState()) <= 0) {
    leagueNet.set({ week, room: null, rows: [], at: Date.now(), loading: false, error: false });
    return;
  }
  leagueNet.set({ loading: true });
  try {
    const { sb } = await api();
    const room = await ensureRoom();
    const data = check(await sb.from('league_board').select('user_id, name, avatar, xp').eq('room', room).order('xp', { ascending: false }).limit(50)) as {
      user_id: string;
      name: string;
      avatar: number;
      xp: number;
    }[];
    const rows = data.map((r) => ({ id: r.user_id, name: r.name, avatar: r.avatar, xp: r.xp }));
    leagueNet.set({ week, room, rows: sortRows(rows), at: Date.now(), loading: false, error: false });
  } catch (e) {
    leagueNet.set({ loading: false, error: true });
    throw e;
  }
}

/** Свой опыт в таблице — сразу, не дожидаясь сервера. */
export function patchMyXp(uid: string, xp: number) {
  const { rows } = leagueNet.get();
  const i = rows.findIndex((r) => r.id === uid);
  if (i < 0) return;
  const next = rows.slice();
  next[i] = { ...next[i], xp };
  leagueNet.set({ rows: sortRows(next) });
}

/** Обновить таблицу, если она устарела (для карточки лиги сбоку). */
export function refreshBoardIfOld(ms = 120000) {
  const st = leagueNet.get();
  if (!st.loading && Date.now() - st.at > ms) loadBoard().catch(() => undefined);
}

/** Следить за группой в реальном времени, пока открыта страница лиги. */
export function watchBoard(): () => void {
  let stopped = false;
  let ch: RealtimeChannel | null = null;
  let reload = 0;
  const later = () => {
    window.clearTimeout(reload);
    reload = window.setTimeout(() => loadBoard().catch(() => undefined), 1200);
  };
  const poll = window.setInterval(() => {
    if (document.visibilityState === 'visible') loadBoard().catch(() => undefined);
  }, 60000);
  (async () => {
    await loadBoard().catch(() => undefined);
    const room = leagueNet.get().room;
    const sb = await getClient();
    if (stopped || !room || !sb) return;
    ch = sb
      .channel('league:' + room)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_members', filter: `room=eq.${room}` }, (p) => {
        const row = p.new as { user_id?: string; xp?: number } | undefined;
        const { rows } = leagueNet.get();
        const i = row?.user_id ? rows.findIndex((r) => r.id === row.user_id) : -1;
        if (i < 0 || typeof row?.xp !== 'number') return later();
        const next = rows.slice();
        next[i] = { ...next[i], xp: row.xp };
        leagueNet.set({ rows: sortRows(next) });
      })
      .subscribe((status) => leagueNet.set({ live: status === 'SUBSCRIBED' }));
  })();
  return () => {
    stopped = true;
    window.clearInterval(poll);
    window.clearTimeout(reload);
    leagueNet.set({ live: false });
    if (ch) getClient().then((sb) => sb?.removeChannel(ch!));
  };
}

/** Сброс при смене аккаунта. */
export function resetLeague() {
  rooms.clear();
  leagueNet.set({ week: '', room: null, rows: [], at: 0, loading: false, live: false, error: false });
}
