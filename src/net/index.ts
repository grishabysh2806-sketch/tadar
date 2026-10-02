/*
 * Запуск связи с сервером и вход.
 * После знакомства создаётся гостевой аккаунт (без почты и паролей). Почту можно
 * привязать позже — чтобы продолжать на другом устройстве.
 */
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getState, replaceState, defaultState, subscribe } from '../state/store';
import { api, check, getClient, net, serverOn, setOfflineHandler } from './client';
import { pullProgress, startSync, stopSync, syncNow } from './sync';
import { loadBoard, resetLeague, settleOnline } from './league';
import { refreshStudentClass } from './classes';
import { applyGrants, settleLeague } from '../state/game';
import { toast } from '../ui/kit';
import { loadCommunityVoices, restoreCommunityVoices } from './voices';

export { serverOn, net } from './client';

let started = false;
let grantsAt = 0;

/** Применить подарки администратора и сообщить о них. */
function grantsGiven(raw: unknown) {
  grantsAt = Date.now();
  const opened = applyGrants(raw);
  if (opened.length) toast('Вам открыт эпос кай!', { icon: '🪕', sub: opened.length > 1 ? 'Все фрагменты сказаний — в разделе «Эпос кай»' : 'Новый фрагмент — в разделе «Эпос кай»', ms: 6000 });
}

/** Вернулись во вкладку — проверить, не появилось ли подарков (не чаще раза в минуту). */
async function refreshGrants() {
  if (net.get().status !== 'online' || Date.now() - grantsAt < 60000) return;
  grantsAt = Date.now();
  try {
    const { sb, uid } = await api();
    const prof = check(await sb.from('profiles').select('grants').eq('id', uid).maybeSingle()) as { grants: unknown } | null;
    grantsGiven(prof?.grants);
  } catch {
    /* повторим в следующий раз */
  }
}
let retryTimer = 0;
let retryMs = 15000;
let guestBusy = false;
let leaving = false;

function markOffline() {
  if (net.get().status === 'online' || net.get().status === 'connecting') net.set({ status: 'offline' });
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void reconnect(), retryMs);
  retryMs = Math.min(retryMs * 2, 5 * 60000);
}

/** Гостевой вход выключен в Supabase: живём на устройстве, проверяем раз в 5 минут. */
function guestsDisabled() {
  net.set({ status: 'disabled' });
  settleLeague();
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void signInGuest(), 5 * 60000);
}

async function signInGuest() {
  if (guestBusy || leaving) return;
  guestBusy = true;
  // при повторной проверке не мигаем «Подключаемся…»
  if (net.get().status !== 'disabled') net.set({ status: 'connecting' });
  try {
    const sb = await getClient();
    if (!sb) throw new Error('offline');
    const { error } = await sb.auth.signInAnonymously();
    if (error) {
      if ((error as { code?: string }).code === 'anonymous_provider_disabled') return guestsDisabled();
      throw error;
    }
    // дальше — onAuthStateChange(SIGNED_IN)
  } catch {
    if (net.get().status === 'disabled') guestsDisabled();
    else markOffline();
  } finally {
    guestBusy = false;
  }
}

/** Всё, что нужно после входа: прогресс, лига, класс, общие голоса. */
async function connect() {
  try {
    await pullProgress();
    net.set({ status: 'online' });
    retryMs = 15000;
    startSync();
    const { sb, uid } = await api();
    // почту могли подтвердить ссылкой из письма на другом устройстве — берём свежие данные
    const fresh = await sb.auth.getUser();
    if (fresh.data.user) net.set({ email: fresh.data.user.email || null, anonymous: !!fresh.data.user.is_anonymous });
    const prof = check(await sb.from('profiles').select('role, grants').eq('id', uid).maybeSingle()) as { role: string; grants: unknown } | null;
    net.set({ moderator: prof?.role === 'moderator' });
    grantsGiven(prof?.grants);
    await settleOnline();
    await syncNow();
    void loadBoard().catch(() => undefined);
    void refreshStudentClass().catch(() => undefined);
    void loadCommunityVoices().catch(() => undefined);
  } catch {
    markOffline();
  }
}

async function onAuth(event: AuthChangeEvent, session: Session | null) {
  const cur = net.get();
  if (session && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
    net.set({ email: session.user.email || null, anonymous: !!session.user.is_anonymous });
    return;
  }
  if (!session) {
    stopSync();
    resetLeague();
    net.set({ status: 'wait', uid: null, email: null, anonymous: true, moderator: false });
    if (getState().settings.onboarded) void signInGuest();
    return;
  }
  if (session.user.id === cur.uid && (cur.status === 'online' || cur.status === 'connecting')) {
    net.set({ email: session.user.email || null, anonymous: !!session.user.is_anonymous });
    return;
  }
  if (cur.uid && cur.uid !== session.user.id) {
    stopSync();
    resetLeague();
  }
  net.set({ status: 'connecting', uid: session.user.id, email: session.user.email || null, anonymous: !!session.user.is_anonymous, moderator: false });
  await connect();
}

async function reconnect() {
  const st = net.get();
  if (st.status !== 'offline' && st.status !== 'wait' && st.status !== 'disabled') return;
  const sb = await getClient();
  if (!sb) return markOffline();
  const { data } = await sb.auth.getSession();
  if (data.session) {
    net.set({ status: 'connecting', uid: data.session.user.id, email: data.session.user.email || null, anonymous: !!data.session.user.is_anonymous });
    await connect();
  } else if (getState().settings.onboarded) {
    await signInGuest();
  }
}

/** Запуск после первого кадра. */
export async function startBackend() {
  if (!serverOn || started) return;
  started = true;
  restoreCommunityVoices();
  setOfflineHandler(markOffline);
  const sb = await getClient();
  if (!sb) {
    net.set({ status: 'offline' });
    markOffline();
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    // внутри колбэка нельзя ждать других запросов Supabase — продолжаем после него
    window.setTimeout(() => void onAuth(event, session), 0);
  });
  // аккаунт нужен после знакомства
  subscribe(() => {
    if (net.get().status === 'wait' && getState().settings.onboarded) void signInGuest();
  });
  window.addEventListener('online', () => void reconnect());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (net.get().status === 'online') void syncNow();
    } else if (net.get().status === 'offline') void reconnect();
    else void refreshGrants();
  });
}

/** Повторить подключение сейчас (кнопка «Повторить»). */
export function retryNow() {
  retryMs = 15000;
  void reconnect();
}

/* ── Почта: привязка и вход по коду из письма ─────────────────────── */

const redirect = () => location.origin + location.pathname;

/** Привязать почту к гостевому аккаунту — придёт письмо с кодом. */
export async function linkEmail(email: string) {
  const { sb } = await api();
  const { error } = await sb.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirect() });
  if (error) throw error;
}

export async function confirmLinkEmail(email: string, code: string) {
  const { sb } = await api();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email_change' });
  if (error) throw error;
}

/** Войти в аккаунт с почтой на этом устройстве — придёт письмо с кодом. */
export async function sendLoginCode(email: string) {
  const sb = await getClient();
  if (!sb) throw new Error('offline');
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: redirect() } });
  if (error) throw error;
}

export async function confirmLogin(email: string, code: string) {
  const sb = await getClient();
  if (!sb) throw new Error('offline');
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

/** Выйти: прогресс остаётся в аккаунте, устройство начинает с чистого листа. */
export async function signOut() {
  const sb = await getClient();
  leaving = true;
  stopSync();
  resetLeague();
  try {
    replaceState(defaultState());
    await sb?.auth.signOut({ scope: 'local' });
  } finally {
    leaving = false;
  }
}
