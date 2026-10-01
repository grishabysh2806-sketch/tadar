/*
 * Сохранение прогресса в личном хранилище просмотрщика claude.ai
 * (db: data/users/<id>/progress). Работает только там, где просмотрщик даёт
 * хранилище и право записи; иначе прогресс живёт в браузере (localStorage).
 */
import { getState, replaceState, subscribe, fromSaved } from '../state/store';
import { useCapability } from './platform';

export type CloudStatus = 'off' | 'available' | 'connecting' | 'on' | 'local-only';

interface DocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface DB {
  doc(path: string): DocRef;
}
interface UserCap {
  id(): Promise<string | null>;
}
interface Permissions {
  state(name: string): Promise<string>;
  request(names?: readonly string[]): Promise<Record<string, string>>;
}

let status: CloudStatus = 'off';
const listeners = new Set<() => void>();
const setStatus = (s: CloudStatus) => {
  status = s;
  listeners.forEach((l) => l());
};
export const cloudStatus = () => status;
export const onCloudStatus = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

let ref: DocRef | null = null;
let lastPushed = '';
let timer = 0;
let inflight = false;
let again = false;
let started = false;

async function push() {
  if (!ref || status !== 'on') return;
  if (inflight) {
    again = true;
    return;
  }
  const s = getState();
  const json = JSON.stringify(s);
  if (json === lastPushed) return;
  inflight = true;
  try {
    await ref.set({ v: 1, updatedAt: s.updatedAt, state: json });
    lastPushed = json;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    // нет права записи (например, только просмотр) — остаёмся на localStorage
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked' || code === 'quota_exceeded') setStatus('local-only');
  } finally {
    inflight = false;
    if (again) {
      again = false;
      schedule(1500);
    }
  }
}

function schedule(ms = 4000) {
  window.clearTimeout(timer);
  timer = window.setTimeout(push, ms);
}

/**
 * Подключение. Без ask — только если разрешение уже дано (ничего не спрашиваем
 * при открытии страницы); с ask — по нажатию кнопки, с одним запросом разрешения.
 */
export async function connectCloud(ask = false) {
  if (started && status === 'on') return;
  const perms = await useCapability<Permissions>('permissions');
  if (perms) {
    let st = await perms.state('db');
    if (st === 'prompt' && ask) st = (await perms.request(['db', 'user'])).db ?? 'denied';
    if (st === 'prompt') return setStatus('available');
    if (st !== 'granted') return setStatus('off');
  }
  const db = await useCapability<DB>('db');
  const user = await useCapability<UserCap>('user');
  if (!db || !user) return setStatus('off');
  const id = await user.id();
  if (!id) return setStatus('off');
  setStatus('connecting');
  try {
    ref = db.doc(`data/users/${id}/progress`);
    const snap = await ref.get();
    const remote = snap.exists ? snap.data() : undefined;
    const local = getState();
    if (remote && typeof remote.state === 'string') {
      const saved = fromSaved(JSON.parse(remote.state as string));
      // опыт растёт только от занятий — по нему видно, где прогресса больше;
      // время изменения решает лишь при равном опыте (например, смена настроек)
      const better = saved.xp > local.xp || (saved.xp === local.xp && Number(remote.updatedAt) > local.updatedAt);
      if (better) {
        lastPushed = remote.state as string;
        replaceState(saved);
      }
    }
    setStatus('on');
    if (!started) {
      started = true;
      subscribe(() => schedule());
    }
    await push();
  } catch {
    ref = null;
    setStatus('local-only');
  }
}

/** При закрытии вкладки — последняя попытка сохранить. */
export function flushCloud() {
  if (status === 'on') push();
}
