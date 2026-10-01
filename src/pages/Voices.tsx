import { useEffect, useMemo, useRef, useState } from 'react';
import { UNITS } from '../data/course';
import { ITEMS, ruShow } from '../data/vocab';
import type { Item } from '../data/types';
import { listRecordings, saveRecording, deleteRecording, onRecordingsChange, type Recording } from '../audio/voice';
import { questEvent, runAchievementCheck, ACHIEVEMENTS } from '../state/game';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Mascot, Modal, ShorText, SpeakButton, toast } from '../ui/kit';
import { cx, fmtDate, plural } from '../lib/util';
import { normalize } from '../lib/text';
import { sfx } from '../audio/engine';
import { PageHead } from '../layout/Layout';
import { saveFile } from '../lib/platform';

const PROJECT_GOAL = 500;
const RELATIONS = ['бабушка', 'дедушка', 'мама', 'папа', 'родственник', 'земляк', 'я сам(а)'];

function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  return '';
}

export default function Voices() {
  const [recs, setRecs] = useState<Recording[]>([]);
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');
  const [unit, setUnit] = useState('u1');
  const [target, setTarget] = useState<Item | null>(null);
  const items = useStore((s) => s.items);

  const load = () => listRecordings().then(setRecs);
  useEffect(() => {
    load();
    return onRecordingsChange(load);
  }, []);

  const recorded = useMemo(() => new Set(recs.map((r) => normalize(r.text))), [recs]);
  const u = UNITS.find((x) => x.id === unit)!;
  const words = u.lessons
    .flatMap((l) => l.items)
    .map((id) => ITEMS[id])
    .filter((it) => filter === 'all' || !recorded.has(normalize(it.shor)));
  const learnedFirst = [...words].sort((a, b) => Number(!!items[b.id]?.c) - Number(!!items[a.id]?.c));

  return (
    <div className="page voices">
      <PageHead title="Голоса старших" sub="Открытый аудиословарь шорской речи" icon="voices" />

      <section className="voices-hero card">
        <div className="grow">
          <h3>Запишите, как звучит шорский в вашей семье</h3>
          <p>
            Попросите бабушку или дедушку произнести слово — и запишите. Записи заменят синтез речи в уроках, а позже станут основой открытого аудиословаря и будущего ИИ-распознавания
            шорской речи.
          </p>
          <div className="vh-stats">
            <div>
              <b>{recs.length}</b>
              <span>{plural(recs.length, ['запись', 'записи', 'записей'])} у вас</span>
            </div>
            <div className="grow">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontWeight: 800, fontSize: 13 }}>
                  Цель пилота — {PROJECT_GOAL} записей
                </span>
              </div>
              <div className="bar blue">
                <i style={{ width: `${Math.min(100, (recs.length / PROJECT_GOAL) * 100)}%` }} />
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
          ['🔊', 'Слушайте в уроках', 'родной голос вместо синтеза'],
        ].map(([i, t, s]) => (
          <div key={t} className="step3">
            <span>{i}</span>
            <b>{t}</b>
            <small>{s}</small>
          </div>
        ))}
      </div>

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
          const has = recorded.has(normalize(it.shor));
          return (
            <div key={it.id} className="wl-row">
              <SpeakButton text={it.shor} size="sm" />
              <div className="grow">
                <ShorText text={it.shor} />
                <small>{ruShow(it)}</small>
              </div>
              {has && <span className="pill green">✓ есть голос</span>}
              <button className={cx('btn sm', has ? 'ghost' : '')} onClick={() => setTarget(it)}>
                <Icon name="mic" size={18} /> {has ? 'Ещё' : 'Записать'}
              </button>
            </div>
          );
        })}
      </div>

      {recs.length > 0 && (
        <section className="my-recs">
          <h2>Мои записи</h2>
          {recs.map((r) => (
            <RecRow key={r.id} r={r} />
          ))}
          <p className="muted small-note">
            Записи хранятся на этом устройстве. Отправка в общий аудиословарь появится вместе с сервером проекта — каждую запись проверят носитель и преподаватель.
          </p>
        </section>
      )}

      <RecorderModal item={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function RecRow({ r }: { r: Recording }) {
  const [url] = useState(() => URL.createObjectURL(r.blob));
  const [ask, setAsk] = useState(false);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const ext = r.mime.includes('mp4') || r.mime.includes('m4a') || r.mime.includes('aac') ? 'mp4' : 'webm';
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
      </div>
      {ask ? (
        <span className="row" style={{ gap: 6 }}>
          <button className="btn sm red" onClick={() => deleteRecording(r.id!)}>
            Удалить
          </button>
          <button className="btn sm ghost" onClick={() => setAsk(false)}>
            Отмена
          </button>
        </span>
      ) : (
        <>
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
    </div>
  );
}

function RecorderModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'review' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [secs, setSecs] = useState(0);
  const [speaker, setSpeaker] = useState(() => localStorage.getItem('tadar.speaker') ?? '');
  const [relation, setRelation] = useState(() => localStorage.getItem('tadar.relation') ?? 'бабушка');
  const [place, setPlace] = useState(() => localStorage.getItem('tadar.place') ?? '');
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
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
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
    try {
      await saveRecording({
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
      });
      questEvent('record', 1);
      const got = runAchievementCheck();
      got.forEach((id) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) toast(`Достижение: ${a.title}`, { icon: a.icon, sub: a.desc });
      });
      sfx('correct');
      toast('Запись сохранена', { icon: '🎙️', sub: `«${item.shor}» теперь звучит родным голосом` });
      onClose();
    } catch {
      toast('Не удалось сохранить запись', { icon: '⚠️' });
    }
  };

  return (
    <Modal open={!!item} onClose={onClose}>
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
                <input id="rec-speaker" className="input" value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Например: Анна Петровна" />
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
                <input id="rec-place" className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Село, улус или город" />
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

        {phase === 'review' && (
          <>
            <audio src={url} controls autoPlay className="rec-audio" />
            <div className="row">
              <button className="btn ghost grow" onClick={() => setPhase('idle')}>
                <Icon name="refresh" size={18} /> Заново
              </button>
              <button className="btn green grow" onClick={save}>
                Сохранить
              </button>
            </div>
          </>
        )}
        <p className="rec-consent">Записывайте только с согласия говорящего. Записи остаются на вашем устройстве, пока вы сами ими не поделитесь.</p>
      </div>
    </Modal>
  );
}
