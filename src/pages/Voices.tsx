import { useEffect, useMemo, useRef, useState } from 'react';
import { UNITS } from '../data/course';
import { ITEMS, ruShow } from '../data/vocab';
import type { Item } from '../data/types';
import { listRecordings, saveRecording, deleteRecording, onRecordingsChange, communityTexts, type Recording } from '../audio/voice';
import { recorderMime, VOICE_BITRATE } from '../audio/compress';
import { questEvent, runAchievementCheck, ACHIEVEMENTS } from '../state/game';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Mascot, Modal, ShorText, SpeakButton, toast } from '../ui/kit';
import { cx, fmtDate, plural } from '../lib/util';
import { normalize } from '../lib/text';
import { sfx } from '../audio/engine';
import { PageHead } from '../layout/Layout';
import { saveFile } from '../lib/platform';
import { Pic } from '../ui/Pic';
import { net, useServer, errorText } from '../net/client';
import {
  approveRecording,
  loadCommunityVoices,
  loadVoiceStats,
  pendingRecordings,
  recordingUrl,
  refreshMyStatuses,
  rejectRecording,
  shareRecording,
  unshareRecording,
  voicesNet,
  type RemoteRecording,
} from '../net/voices';

const PROJECT_GOAL = 500;
const RELATIONS = ['бабушка', 'дедушка', 'мама', 'папа', 'родственник', 'земляк', 'я сам(а)'];
const noop = () => undefined;

export default function Voices() {
  const [recs, setRecs] = useState<Recording[]>([]);
  const [community, setCommunity] = useState(() => communityTexts());
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');
  const [unit, setUnit] = useState('u1');
  const [target, setTarget] = useState<Item | null>(null);
  const items = useStore((s) => s.items);
  const n = net.use();
  const vs = voicesNet.use();
  const online = n.status === 'online';
  const serverOn = useServer();

  useEffect(() => {
    const load = () => {
      listRecordings().then(setRecs);
      setCommunity(communityTexts());
    };
    load();
    return onRecordingsChange(load);
  }, []);

  useEffect(() => {
    if (!online) return;
    loadCommunityVoices(false, 60000).catch(noop);
    listRecordings()
      .then((all) => refreshMyStatuses(all))
      .catch(noop);
  }, [online]);
  useEffect(() => {
    if (online && Date.now() - vs.at > 60000) loadVoiceStats().catch(noop);
  }, [online, vs.at]);

  const mine = useMemo(() => new Set(recs.map((r) => normalize(r.text))), [recs]);
  const u = UNITS.find((x) => x.id === unit)!;
  const words = u.lessons
    .flatMap((l) => l.items)
    .map((id) => ITEMS[id])
    .filter((it) => filter === 'all' || !(mine.has(normalize(it.shor)) || community.has(normalize(it.shor))));
  const learnedFirst = [...words].sort((a, b) => Number(!!items[b.id]?.c) - Number(!!items[a.id]?.c));
  const stats = vs.stats;
  const collected = serverOn && stats ? stats.total : recs.length;

  return (
    <div className="page voices">
      <PageHead title="Голоса старших" sub="Открытый аудиословарь шорской речи" icon="voices" />

      <section className="voices-hero card">
        <div className="grow">
          <h3>Запишите, как звучит шорский в вашей семье</h3>
          <p>
            Попросите бабушку или дедушку произнести слово — и запишите. После проверки запись услышат все ученики в уроках, а позже она станет частью открытого аудиословаря и
            будущего ИИ-распознавания шорской речи.
          </p>
          <div className="vh-stats">
            {serverOn ? (
              <>
                <div>
                  <b>{stats ? stats.approved : '—'}</b>
                  <span>в общем словаре</span>
                </div>
                <div>
                  <b>{recs.length}</b>
                  <span>{plural(recs.length, ['ваша', 'ваши', 'ваших'])}</span>
                </div>
              </>
            ) : (
              <div>
                <b>{recs.length}</b>
                <span>{plural(recs.length, ['запись', 'записи', 'записей'])} у вас</span>
              </div>
            )}
            <div className="grow">
              <span className="muted" style={{ fontWeight: 800, fontSize: 13 }}>
                Цель пилота — {PROJECT_GOAL} записей{serverOn && stats ? ` · собрано ${collected}` : ''}
              </span>
              <div className="bar blue">
                <i style={{ width: `${Math.min(100, (collected / PROJECT_GOAL) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
        <Mascot pose="hero-l" size={150} className="vh-mascot" />
      </section>

      <div className="steps3">
        {[
          ['👵', 'Выберите слово', 'и покажите его старшему'],
          ['🎙️', 'Запишите', 'нажмите кнопку и слушайте'],
          ['🔊', serverOn ? 'Слушайте все' : 'Слушайте в уроках', serverOn ? 'после проверки — в уроках у всех' : 'родной голос вместо синтеза'],
        ].map(([i, t, s]) => (
          <div key={t} className="step3">
            <span>
              <Pic e={i} size={40} />
            </span>
            <b>{t}</b>
            <small>{s}</small>
          </div>
        ))}
      </div>

      {n.moderator && <Moderation />}

      <div className="voices-controls">
        <div className="chips-scroll">
          {UNITS.map((x) => (
            <button key={x.id} className={cx('chip', unit === x.id && 'on')} onClick={() => setUnit(x.id)}>
              <ShorText text={x.shorTitle} />
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={cx(filter === 'todo' && 'on')} onClick={() => setFilter('todo')}>
            Без записи
          </button>
          <button className={cx(filter === 'all' && 'on')} onClick={() => setFilter('all')}>
            Все
          </button>
        </div>
      </div>

      <div className="word-list">
        {learnedFirst.length === 0 && <p className="muted center" style={{ padding: 20 }}>Все слова раздела уже записаны — вы молодец!</p>}
        {learnedFirst.map((it) => {
          const key = normalize(it.shor);
          const own = mine.has(key);
          const shared = community.has(key);
          return (
            <div key={it.id} className="wl-row">
              <SpeakButton text={it.shor} size="sm" />
              <div className="grow">
                <ShorText text={it.shor} />
                <small>{ruShow(it)}</small>
              </div>
              {own ? <span className="pill green">✓ ваш голос</span> : shared && <span className="pill blue">голос из словаря</span>}
              <button className={cx('btn sm', own || shared ? 'ghost' : '')} onClick={() => setTarget(it)}>
                <Icon name="mic" size={18} /> {own || shared ? 'Ещё' : 'Записать'}
              </button>
            </div>
          );
        })}
      </div>

      {recs.length > 0 && (
        <section className="my-recs">
          <h2>Мои записи</h2>
          {recs.map((r) => (
            <RecRow key={r.id} r={r} online={online} />
          ))}
          <p className="muted small-note">
            {serverOn
              ? 'Записи хранятся на этом устройстве. Отправленные в общий словарь проверяют носитель языка и преподаватель — после проверки их слышат все ученики.'
              : 'Записи хранятся на этом устройстве. Отправка в общий аудиословарь появится вместе с сервером проекта — каждую запись проверят носитель и преподаватель.'}
          </p>
        </section>
      )}

      <RecorderModal item={target} onClose={() => setTarget(null)} />
    </div>
  );
}

const STATUS: Record<NonNullable<Recording['remoteStatus']>, [string, string]> = {
  pending: ['На проверке', 'gold'],
  approved: ['В общем словаре', 'green'],
  rejected: ['Не принята', 'red'],
};

function RecRow({ r, online }: { r: Recording; online: boolean }) {
  const serverOn = useServer();
  const [url] = useState(() => URL.createObjectURL(r.blob));
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const ext = r.mime.includes('mp4') || r.mime.includes('m4a') || r.mime.includes('aac') ? 'mp4' : r.mime.includes('wav') ? 'wav' : r.mime.includes('mpeg') ? 'mp3' : 'webm';
  const st = r.remoteStatus ? STATUS[r.remoteStatus] : null;

  const share = async () => {
    setBusy(true);
    try {
      await shareRecording(r);
      toast('Запись отправлена на проверку', { icon: '📨', sub: 'После проверки её услышат все ученики' });
    } catch (e) {
      toast('Не удалось отправить', { icon: '⚠️', sub: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      if (r.remoteId && r.remoteStatus !== 'rejected') await unshareRecording(r);
      await deleteRecording(r.id!);
    } catch (e) {
      toast('Не удалось удалить из общего словаря', { icon: '⚠️', sub: errorText(e) });
      setBusy(false);
    }
  };

  return (
    <div className="rec-row">
      <audio src={url} controls preload="none" />
      <div className="grow">
        <ShorText text={r.text} /> <span className="muted">— {r.ru}</span>
        <small>
          {r.speaker || 'Без имени'}
          {r.relation ? ` · ${r.relation}` : ''}
          {r.place ? ` · ${r.place}` : ''} · {fmtDate(r.createdAt)}
        </small>
        {st && <span className={cx('pill rec-status', st[1])}>{st[0]}</span>}
      </div>
      {ask ? (
        <span className="row" style={{ gap: 6 }}>
          <button className="btn sm red" disabled={busy} onClick={remove}>
            Удалить
          </button>
          <button className="btn sm ghost" onClick={() => setAsk(false)}>
            Отмена
          </button>
        </span>
      ) : (
        <>
          {serverOn && (!r.remoteId || r.remoteStatus === 'rejected') && (
            <button className="btn sm" disabled={!online || busy} onClick={share} title={online ? undefined : 'Нет связи с сервером'}>
              <Icon name="voices" size={18} /> {busy ? 'Отправляем…' : r.remoteStatus === 'rejected' ? 'Ещё раз' : 'В словарь'}
            </button>
          )}
          <button
            className="icon-btn"
            aria-label="Сохранить файл"
            title="Сохранить файл"
            onClick={async () => {
              const res = await saveFile(`tadar-${r.text}.${ext}`, r.blob);
              if (res === 'failed') toast('Сохранить файл здесь нельзя', { icon: '⚠️', sub: 'Откройте приложение в отдельной вкладке браузера' });
            }}
          >
            <Icon name="download" size={20} />
          </button>
          <button className="icon-btn" aria-label="Удалить" onClick={() => setAsk(true)}>
            <Icon name="trash" size={20} />
          </button>
        </>
      )}
      {ask && r.remoteId && r.remoteStatus !== 'rejected' && <small className="rec-warn">Запись удалится и из общего словаря.</small>}
    </div>
  );
}

/** Проверка новых записей — для модераторов (носитель языка, преподаватель). */
function Moderation() {
  const [list, setList] = useState<RemoteRecording[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => pendingRecordings().then(setList, () => setList([]));
  useEffect(() => {
    load();
  }, []);
  const act = async (r: RemoteRecording, ok: boolean) => {
    setBusy(r.id);
    try {
      if (ok) await approveRecording(r.id);
      else await rejectRecording(r);
      setList((l) => (l ?? []).filter((x) => x.id !== r.id));
      voicesNet.set({ at: 0 });
      if (ok) loadCommunityVoices(true).catch(noop);
    } catch (e) {
      toast('Не получилось', { icon: '⚠️', sub: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="card moderation">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Проверка записей</h3>
        <button className="icon-btn" aria-label="Обновить" onClick={load}>
          <Icon name="refresh" size={20} />
        </button>
      </div>
      {list === null && <p className="muted">Загружаем…</p>}
      {list?.length === 0 && <p className="muted">Новых записей нет — всё проверено.</p>}
      {list?.map((r) => (
        <div key={r.id} className="rec-row">
          <audio src={recordingUrl(r)} controls preload="none" />
          <div className="grow">
            <ShorText text={r.text} /> <span className="muted">— {r.ru}</span>
            <small>
              {r.speaker || 'Без имени'}
              {r.relation ? ` · ${r.relation}` : ''}
              {r.place ? ` · ${r.place}` : ''} · {fmtDate(Date.parse(r.created_at))} · {Math.round(r.size / 1024)} КБ
            </small>
          </div>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn sm green" disabled={busy === r.id} onClick={() => act(r, true)}>
              Принять
            </button>
            <button className="btn sm red" disabled={busy === r.id} onClick={() => act(r, false)}>
              Отклонить
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}

function RecorderModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'review' | 'sending' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [secs, setSecs] = useState(0);
  const [speaker, setSpeaker] = useState(() => localStorage.getItem('tadar.speaker') ?? '');
  const [relation, setRelation] = useState(() => localStorage.getItem('tadar.relation') ?? 'бабушка');
  const [place, setPlace] = useState(() => localStorage.getItem('tadar.place') ?? '');
  const [share, setShare] = useState(() => localStorage.getItem('tadar.share') !== '0');
  const n = net.use();
  const serverOn = useServer();
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const t0 = useRef(0);

  const acRef = useRef<AudioContext | null>(null);
  const cleanup = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    acRef.current?.close().catch(() => undefined);
    acRef.current = null;
  };
  useEffect(() => {
    if (!item) {
      cleanup();
      setPhase('idle');
      setBlob(null);
      if (url) URL.revokeObjectURL(url);
      setUrl('');
      setSecs(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  useEffect(() => () => cleanup(), []);

  if (!item) return null;

  const start = async () => {
    setErr('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErr('Этот браузер не умеет записывать звук. Загрузите готовую запись из диктофона телефона.');
      setPhase('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = recorderMime();
      // 32 кбит/с: слово весит десятки килобайт — так помещаются тысячи записей
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: VOICE_BITRATE } : { audioBitsPerSecond: VOICE_BITRATE });
      } catch {
        rec = new MediaRecorder(stream);
      }
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setPhase('review');
        cleanup();
      };
      recRef.current = rec;
      rec.start();
      t0.current = Date.now();
      setPhase('rec');
      sfx('tap');
      // живая волна
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      acRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const draw = () => {
        const cv = canvasRef.current;
        const ctx = cv?.getContext('2d');
        if (cv && ctx) {
          const w = (cv.width = cv.clientWidth * 2);
          const h = (cv.height = cv.clientHeight * 2);
          an.getByteTimeDomainData(data);
          ctx.clearRect(0, 0, w, h);
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#EF6461';
          ctx.beginPath();
          for (let i = 0; i < data.length; i++) {
            const x = (i / data.length) * w;
            const y = (data[i] / 255) * h;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        setSecs(Math.floor((Date.now() - t0.current) / 1000));
        if (Date.now() - t0.current > 15000) stop();
        else rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);
    } catch (e) {
      const name = (e as Error).name;
      setErr(
        name === 'NotAllowedError'
          ? 'Нет доступа к микрофону. Разрешите его в настройках браузера или загрузите готовую запись из диктофона телефона.'
          : name === 'NotFoundError'
            ? 'Микрофон не найден. Подключите его и попробуйте снова.'
            : 'Микрофон здесь недоступен. Загрузите готовую запись из диктофона телефона — это работает везде.',
      );
      setPhase('error');
    }
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('audio/') && !/\.(m4a|mp3|wav|ogg|webm|aac|amr|3gp)$/i.test(f.name)) {
      setErr('Это не аудиофайл. Выберите запись голоса: m4a, mp3, wav, ogg или webm.');
      setPhase('error');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setErr('Файл больше 15 МБ. Для одного слова хватит короткой записи на несколько секунд.');
      setPhase('error');
      return;
    }
    const b = new Blob([f], { type: f.type || 'audio/mp4' });
    setBlob(b);
    setUrl(URL.createObjectURL(b));
    setSecs(0);
    setPhase('review');
  };

  const save = async () => {
    if (!blob) return;
    localStorage.setItem('tadar.speaker', speaker);
    localStorage.setItem('tadar.relation', relation);
    localStorage.setItem('tadar.place', place);
    localStorage.setItem('tadar.share', share ? '1' : '0');
    const rec: Recording = {
      itemId: item.id,
      text: item.shor,
      ru: ruShow(item),
      speaker: speaker.trim(),
      relation,
      place: place.trim(),
      createdAt: Date.now(),
      mime: blob.type,
      duration: secs,
      blob,
    };
    let id: number;
    try {
      id = await saveRecording(rec);
    } catch {
      toast('Не удалось сохранить запись', { icon: '⚠️' });
      return;
    }
    questEvent('record', 1);
    runAchievementCheck().forEach((aid) => {
      const a = ACHIEVEMENTS.find((x) => x.id === aid);
      if (a) toast(`Достижение: ${a.title}`, { icon: a.icon, sub: a.desc });
    });
    sfx('correct');
    if (serverOn && share && n.status === 'online') {
      setPhase('sending');
      try {
        await shareRecording({ ...rec, id });
        toast('Запись отправлена на проверку', { icon: '📨', sub: `«${item.shor}» услышат все ученики после проверки` });
      } catch (e) {
        toast('Запись сохранена на устройстве', { icon: '🎙️', sub: `В словарь не ушла: ${errorText(e)} Отправьте позже из «Моих записей».` });
      }
    } else {
      toast('Запись сохранена', { icon: '🎙️', sub: `«${item.shor}» теперь звучит родным голосом` });
    }
    onClose();
  };

  return (
    <Modal open={!!item} onClose={phase === 'sending' ? undefined : onClose} dismissable={phase !== 'sending'}>
      <div className="recorder">
        <span className="eyebrow">Голоса старших</span>
        <div className="rec-word">
          <SpeakButton text={item.shor} />
          <div>
            <ShorText text={item.shor} className="rec-shor" />
            <small>{ruShow(item)}</small>
          </div>
        </div>

        {phase === 'error' && <p className="rec-err">{err}</p>}

        {(phase === 'idle' || phase === 'error') && (
          <>
            <div className="rec-form">
              <label>
                <span className="label">Кто говорит</span>
                <input id="rec-speaker" className="input" value={speaker} maxLength={60} onChange={(e) => setSpeaker(e.target.value)} placeholder="Например: Анна Петровна" />
              </label>
              <div className="chips">
                {RELATIONS.map((r) => (
                  <button key={r} className={cx('chip', relation === r && 'on')} onClick={() => setRelation(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <label>
                <span className="label">Откуда (необязательно)</span>
                <input id="rec-place" className="input" value={place} maxLength={60} onChange={(e) => setPlace(e.target.value)} placeholder="Село, улус или город" />
              </label>
            </div>
            <div className="rec-actions">
              <button className="rec-big" onClick={start} aria-label="Начать запись">
                <Icon name="mic" size={40} />
              </button>
              <label className="rec-upload">
                <input id="rec-file" type="file" accept="audio/*" onChange={(e) => onFile(e.target.files?.[0])} />
                <Icon name="download" size={22} style={{ transform: 'rotate(180deg)' }} />
                <span>Загрузить файл</span>
              </label>
            </div>
            <p className="muted center">Запишите здесь или загрузите запись из диктофона. Попросите произнести слово 2–3 раза.</p>
          </>
        )}

        {phase === 'rec' && (
          <>
            <canvas ref={canvasRef} className="rec-wave" />
            <button className="rec-big on" onClick={stop} aria-label="Остановить">
              <Icon name="stop" size={36} />
            </button>
            <p className="center rec-time">● Идёт запись · 0:{String(secs).padStart(2, '0')}</p>
          </>
        )}

        {(phase === 'review' || phase === 'sending') && (
          <>
            <audio src={url} controls autoPlay className="rec-audio" />
            {serverOn && (
              <label className="rec-share">
                <input type="checkbox" checked={share} disabled={phase === 'sending'} onChange={(e) => setShare(e.target.checked)} />
                <span>
                  Отправить в общий аудиословарь
                  <small>{n.status === 'online' ? 'После проверки запись услышат все ученики. Файл сожмём до нескольких десятков килобайт.' : 'Сейчас нет связи — запись останется на устройстве, отправить можно позже.'}</small>
                </span>
              </label>
            )}
            <div className="row">
              <button className="btn ghost grow" disabled={phase === 'sending'} onClick={() => setPhase('idle')}>
                <Icon name="refresh" size={18} /> Заново
              </button>
              <button className="btn green grow" disabled={phase === 'sending'} onClick={save}>
                {phase === 'sending' ? 'Отправляем…' : 'Сохранить'}
              </button>
            </div>
          </>
        )}
        <p className="rec-consent">
          {serverOn
            ? 'Записывайте только с согласия говорящего. В общем словаре видны слово, имя говорящего и место записи.'
            : 'Записывайте только с согласия говорящего. Записи остаются на вашем устройстве, пока вы сами ими не поделитесь.'}
        </p>
      </div>
    </Modal>
  );
}
