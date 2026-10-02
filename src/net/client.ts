/*
 * Связь с сервером «Тадара» (Supabase).
 * Адрес и публичный ключ проекта берутся из переменных окружения сборки
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Без них, во встроенных окнах
 * и без сети приложение работает как раньше — на устройстве.
 * Сам клиент Supabase подгружается отдельным файлом уже после первого кадра.
 */
import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * Проект Supabase «tadar». Публичный ключ (publishable) предназначен для браузера:
 * данные защищены правилами RLS в базе. Для другого проекта — переменные
 * VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (или пустые, чтобы отключить сервер).
 */
const PROJECT_URL = 'https://ccdoomaexjdkyglfdvwb.supabase.co';
const PROJECT_KEY = 'sb_publishable_brzJURyEftzCGqvbBpZFHg_L9wS0ZNE';

const env = import.meta.env;
const URL_ = String(env.VITE_SUPABASE_URL ?? PROJECT_URL)
  .trim()
  .replace(/\/+$/, '');
const KEY = String(env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? PROJECT_KEY).trim();

function framed() {
  try {
    return window.top !== window;
  } catch {
    return true;
  }
}

/** Сервер настроен и доступен из этого окна (во встроенных окнах claude.ai сеть закрыта). */
export const serverOn = !!URL_ && !!KEY && !framed();

/** Прямая ссылка на файл из публичного хранилища. */
export const publicUrl = (bucket: string, path: string) => `${URL_}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

/* ── Маленькие наблюдаемые хранилища для данных с сервера ─────────── */

export function store<T extends object>(init: T) {
  let value = init;
  const ls = new Set<() => void>();
  const subscribe = (l: () => void) => {
    ls.add(l);
    return () => {
      ls.delete(l);
    };
  };
  return {
    get: () => value,
    set(patch: Partial<T>) {
      value = { ...value, ...patch };
      ls.forEach((l) => l());
    },
    subscribe,
    use: () => useSyncExternalStore(subscribe, () => value),
  };
}

/**
 * off — сервер не настроен; wait — ждём окончания знакомства (аккаунт ещё не нужен);
 * connecting — входим; online — всё работает; offline — нет связи, повторим позже;
 * disabled — сервер не принимает гостевые аккаунты (выключено в Supabase):
 * приложение работает на устройстве и время от времени проверяет снова.
 */
export type NetStatus = 'off' | 'wait' | 'connecting' | 'online' | 'offline' | 'disabled';

export interface Net {
  status: NetStatus;
  uid: string | null;
  email: string | null;
  anonymous: boolean;
  moderator: boolean;
}

export const net = store<Net>({ status: serverOn ? 'wait' : 'off', uid: null, email: null, anonymous: true, moderator: false });

/** Сервер работает для приложения: настроен и принимает аккаунты. */
export const serverActive = () => serverOn && net.get().status !== 'disabled';

/** То же для компонентов: при смене статуса страница перерисуется. */
export function useServer() {
  const n = net.use();
  return serverOn && n.status !== 'disabled';
}

/* ── Клиент ───────────────────────────────────────────────────────── */

let sb: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

export function getClient(): Promise<SupabaseClient | null> {
  if (!serverOn) return Promise.resolve(null);
  if (sb) return Promise.resolve(sb);
  loading ??= import('@supabase/supabase-js')
    .then(({ createClient }) => {
      sb = createClient(URL_, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'tadar.auth' },
      });
      return sb;
    })
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

export class OfflineError extends Error {
  constructor() {
    super('offline');
  }
}

/** Клиент и id пользователя для запроса; без входа — OfflineError. */
export async function api(): Promise<{ sb: SupabaseClient; uid: string }> {
  const c = await getClient();
  const uid = net.get().uid;
  if (!c || !uid) throw new OfflineError();
  return { sb: c, uid };
}

export function isNetworkError(e: unknown) {
  if (e instanceof OfflineError) return true;
  const m = String((e as { message?: string } | null)?.message ?? e);
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|networkerror|network request|load failed|timed? ?out|offline/i.test(m);
}

let offlineHandler: () => void = () => undefined;
export const setOfflineHandler = (fn: () => void) => {
  offlineHandler = fn;
};

/** Результат запроса Supabase → данные; ошибка → исключение (сетевой сбой — «нет связи»). */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) {
    if (isNetworkError(res.error)) offlineHandler();
    throw res.error;
  }
  return res.data;
}

/** Понятный текст ошибки для тоста. */
export function errorText(e: unknown, fallback = 'Не получилось. Попробуйте ещё раз.') {
  if (isNetworkError(e)) return 'Нет связи с сервером. Проверьте интернет.';
  const m = String((e as { message?: string } | null)?.message ?? '');
  if (/rate limit|too many|429/i.test(m)) return 'Слишком много попыток. Подождите немного.';
  return fallback;
}

export const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')).join('');
