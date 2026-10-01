/*
 * Общий аудиословарь «Голосов старших».
 * Запись уходит на проверку; после одобрения модератором её слышат все
 * ученики в уроках. Файлы — в хранилище Supabase (папка = id автора),
 * описание — в таблице recordings.
 */
import { setCommunityVoices, updateRecording, type Recording } from '../audio/voice';
import { prepareForUpload, extFor } from '../audio/compress';
import { api, check, net, publicUrl, randomId, store } from './client';

const BUCKET = 'voices';
const CACHE_KEY = 'tadar.voices.community';

export interface VoiceStats {
  approved: number;
  pending: number;
  total: number;
  bytes: number | null;
}

export const voicesNet = store<{ stats: VoiceStats | null; at: number }>({ stats: null, at: 0 });

export interface RemoteRecording {
  id: string;
  user_id: string;
  text: string;
  ru: string;
  speaker: string;
  relation: string;
  place: string;
  path: string;
  mime: string;
  duration: number;
  size: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const cut = (s: string, n: number) => (s || '').trim().slice(0, n);

/* ── Проверенные записи для уроков ───────────────────────────────── */

/** Сразу при запуске — из кэша, потом свежий список с сервера. */
export function restoreCommunityVoices() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) setCommunityVoices((JSON.parse(raw) as { list: { text: string; url: string }[] }).list);
  } catch {
    /* noop */
  }
}

let lastLoad = 0;
/** maxAge — насколько свежим должен быть список (по умолчанию 10 минут). */
export async function loadCommunityVoices(force = false, maxAge = 10 * 60000) {
  if (!force && Date.now() - lastLoad < maxAge) return;
  const { sb } = await api();
  const rows = check(await sb.from('recordings').select('text, path').eq('status', 'approved').order('created_at', { ascending: false }).limit(3000)) as {
    text: string;
    path: string;
  }[];
  lastLoad = Date.now();
  const list = rows.map((r) => ({ text: r.text, url: publicUrl(BUCKET, r.path) }));
  setCommunityVoices(list);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list }));
  } catch {
    /* noop */
  }
}

export async function loadVoiceStats() {
  const { sb } = await api();
  const stats = check(await sb.rpc('voices_stats')) as VoiceStats;
  voicesNet.set({ stats, at: Date.now() });
  return stats;
}

/* ── Свои записи ─────────────────────────────────────────────────── */

/** Отправить запись в общий словарь (сжатую), отметить её у себя. */
export async function shareRecording(r: Recording): Promise<Recording> {
  const { sb, uid } = await api();
  const prep = await prepareForUpload(r.blob);
  const path = `${uid}/${randomId()}.${extFor(prep.mime)}`;
  const up = await sb.storage.from(BUCKET).upload(path, prep.blob, { contentType: prep.mime, cacheControl: '31536000', upsert: false });
  check(up);
  const res = await sb
    .from('recordings')
    .insert({
      item_id: r.itemId ? cut(r.itemId, 32) : null,
      text: cut(r.text, 60),
      ru: cut(r.ru, 80),
      speaker: cut(r.speaker, 60),
      relation: cut(r.relation, 30),
      place: cut(r.place, 60),
      path,
      mime: prep.mime,
      duration: Math.round(Math.min(30, Math.max(0, prep.duration)) * 10) / 10,
      size: prep.blob.size,
    })
    .select('id')
    .single();
  if (res.error) {
    await sb.storage.from(BUCKET).remove([path]);
    check(res);
  }
  const next: Recording = { ...r, remoteId: (res.data as { id: string }).id, remotePath: path, remoteStatus: 'pending' };
  await updateRecording(next);
  voicesNet.set({ at: 0 });
  return next;
}

/** Статусы проверки своих записей → в локальные записи. */
export async function refreshMyStatuses(local: Recording[]) {
  const sent = local.filter((r) => r.remoteId);
  if (!sent.length) return;
  const { sb } = await api();
  const rows = check(
    await sb
      .from('recordings')
      .select('id, status')
      .in(
        'id',
        sent.map((r) => r.remoteId!),
      ),
  ) as { id: string; status: RemoteRecording['status'] }[];
  const byId = new Map(rows.map((r) => [r.id, r.status]));
  for (const r of sent) {
    // строки нет — запись отклонена и удалена модератором
    const st = byId.get(r.remoteId!) ?? 'rejected';
    if (st !== r.remoteStatus) await updateRecording({ ...r, remoteStatus: st });
  }
}

/** Убрать свою запись из общего словаря. */
export async function unshareRecording(r: Recording) {
  if (!r.remoteId) return;
  const { sb } = await api();
  check(await sb.from('recordings').delete().eq('id', r.remoteId));
  if (r.remotePath) await sb.storage.from(BUCKET).remove([r.remotePath]);
}

/* ── Модерация ───────────────────────────────────────────────────── */

export async function pendingRecordings(): Promise<RemoteRecording[]> {
  if (!net.get().moderator) return [];
  const { sb } = await api();
  return check(await sb.from('recordings').select('*').eq('status', 'pending').order('created_at').limit(50)) as RemoteRecording[];
}

export const recordingUrl = (r: { path: string }) => publicUrl(BUCKET, r.path);

export async function approveRecording(id: string) {
  const { sb } = await api();
  check(await sb.from('recordings').update({ status: 'approved' }).eq('id', id));
  lastLoad = 0;
}

/** Отклонённая запись удаляется вместе с файлом — место на бесплатном тарифе дорого. */
export async function rejectRecording(r: RemoteRecording) {
  const { sb } = await api();
  check(await sb.from('recordings').delete().eq('id', r.id));
  await sb.storage.from(BUCKET).remove([r.path]);
}
