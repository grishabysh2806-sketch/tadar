import { useEffect, useMemo, useRef, useState } from 'react';
import { EPICS, epicById } from '../data/epics';
import { UNITS } from '../data/course';
import { useStore } from '../state/store';
import { markEpicPlayed } from '../state/game';
import { Icon } from '../ui/Icon';
import { EpicScene, OrnamentRing, Mountains } from '../ui/Ornament';
import { Mascot, ShorText, SpeakButton } from '../ui/kit';
import { navigate } from '../lib/router';
import { cx } from '../lib/util';
import { KaiSynth, lineDuration } from '../audio/kai';
import { speakShor, stopSpeech } from '../audio/voice';
import { setState } from '../state/store';

export function EpicPage() {
  const epics = useStore((s) => s.epics);
  const opened = EPICS.filter((e) => epics[e.id]).length;
  return (
    <div className="page epic-page">
      <section className="epic-hero">
        <div className="eh-bg" />
        <OrnamentRing size={300} className="eh-sun" color="#F8B818" fill="#F8B818" />
        <Mountains className="eh-mountains" />
        <div className="eh-content">
          <span className="eyebrow light">Награда за разделы</span>
          <h1>Эпос кай</h1>
          <p>
            Кай — горловое пение, которым шорские сказители-кайчи исполняли героические сказания под двухструнный комус. Пройдите раздел — откроется фрагмент.
          </p>
          <div className="eh-progress">
            <div className="bar gold">
              <i style={{ width: `${(opened / EPICS.length) * 100}%` }} />
            </div>
            <b>
              {opened}/{EPICS.length}
            </b>
          </div>
        </div>
      </section>

      <div className="epic-grid">
        {EPICS.map((e) => {
          const u = UNITS.find((x) => x.id === e.unitId)!;
          const open = !!epics[e.id];
          return (
            <button key={e.id} className={cx('epic-card', !open && 'locked')} onClick={() => navigate('epic/' + e.id)}>
              <div className="ec-art">
                <EpicScene scene={e.scene} locked={!open} />
                {open ? (
                  <span className="ec-play">
                    <Icon name="play" size={22} />
                  </span>
                ) : (
                  <span className="ec-lock">
                    <Icon name="lock" size={22} />
                  </span>
                )}
              </div>
              <div className="ec-body">
                <small>
                  Раздел {u.n} · {u.title}
                </small>
                <b>{e.title}</b>
                <span className="ec-src">{open ? e.source : 'Откроется после раздела'}</span>
              </div>
            </button>
          );
        })}
      </div>

      <section className="card kai-info">
        <h3>Как звучит кай</h3>
        <div className="kai-facts">
          <div>
            <span className="kf-icon">🎶</span>
            <b>
              <ShorText text="қай" /> — кай
            </b>
            <p>Горловое пение: низкий гул и обертоны, похожие на свист. Так поют сказания.</p>
          </div>
          <div>
            <span className="kf-icon">🪕</span>
            <b>
              <ShorText text="қомус" /> — комус
            </b>
            <p>Двухструнный щипковый инструмент. Его ритм похож на бег коня.</p>
          </div>
          <div>
            <span className="kf-icon">🧓</span>
            <b>
              <ShorText text="қайчы" /> — кайчи
            </b>
            <p>Сказитель. Сказание могло длиться всю ночь — и даже три ночи подряд.</p>
          </div>
        </div>
        <p className="kai-note">
          <Icon name="info" size={18} style={{ color: 'var(--blue)', flex: 'none' }} />
          Сейчас музыкальное сопровождение синтезируется прямо в браузере. В следующих версиях его заменят записи носителей и исполнителей эпоса.
        </p>
      </section>
    </div>
  );
}

/* ── Плеер ───────────────────────────────────────────────────── */

function renderLine(line: string) {
  const parts = line.split(/(\([^)]+\))/g);
  return parts.map((p, i) => {
    const m = p.match(/^\((.+)\)$/);
    if (m) {
      return (
        <button
          key={i}
          className="ep-word"
          onClick={(e) => {
            e.stopPropagation();
            speakShor(m[1], { force: true });
          }}
        >
          <ShorText text={m[1]} />
        </button>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function EpicPlayer({ id }: { id: string }) {
  const e = epicById(id);
  const unlocked = useStore((s) => !!s.epics[id]);
  const music = useStore((s) => s.settings.music);
  const synth = useMemo(() => new KaiSynth(), []);
  const [line, setLine] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const counted = useRef(false);
  const linesRef = useRef<HTMLDivElement>(null);

  const durations = useMemo(() => (e ? e.lines.map(lineDuration) : []), [e]);

  useEffect(
    () => () => {
      synth.stop(true);
      stopSpeech();
    },
    [synth],
  );

  // визуализация
  useEffect(() => {
    let raf = 0;
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const an = synth.analyser;
    const data = new Uint8Array(an ? an.frequencyBinCount : 64);
    const draw = () => {
      if (!ctx) return;
      const w = (cv.width = cv.clientWidth * 2);
      const h = (cv.height = cv.clientHeight * 2);
      ctx.clearRect(0, 0, w, h);
      if (an && playing) an.getByteFrequencyData(data);
      const bars = 40;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = playing && an ? data[Math.floor((i / bars) * data.length * 0.7)] / 255 : 0.08 + 0.05 * Math.sin(Date.now() / 600 + i);
        const bh = Math.max(6, v * h * 0.95);
        ctx.fillStyle = i < bars * (Math.max(0, line + 1) / (e?.lines.length || 1)) ? '#139FE0' : '#9FD3F5';
        const x = i * bw + bw * 0.2;
        const y = (h - bh) / 2;
        const r = Math.min(bw * 0.3, bh / 2);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw * 0.6, bh, r);
        else ctx.rect(x, y, bw * 0.6, bh);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [synth, playing, line, e]);

  useEffect(() => {
    const el = linesRef.current?.querySelector('.ep-line.cur');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [line]);

  if (!e) {
    return (
      <div className="epic-player locked-player">
        <div className="ep-bg" />
        <div className="ep-locked">
          <h1>Фрагмент не найден</h1>
          <button className="btn gold lg" onClick={() => navigate('epic')}>
            К эпосу
          </button>
        </div>
      </div>
    );
  }
  const u = UNITS.find((x) => x.id === e.unitId)!;

  const play = () => {
    if (playing) {
      synth.stop();
      setPlaying(false);
      return;
    }
    setEnded(false);
    setLine(-1);
    setPlaying(true);
    if (!counted.current) {
      counted.current = true;
      markEpicPlayed(e.id);
    }
    synth.start(
      e.mood,
      durations,
      (i) => setLine(i),
      () => {
        setPlaying(false);
        setEnded(true);
        setLine(e.lines.length);
      },
      { music },
    );
  };

  const toggleMusic = () => {
    setState((d) => {
      d.settings.music = !d.settings.music;
    });
    synth.setMusic(!music);
  };

  if (!unlocked) {
    return (
      <div className="epic-player locked-player">
        <div className="ep-bg" />
        <div className="ep-top">
          <button className="icon-btn light" onClick={() => navigate('epic')} aria-label="Назад">
            <Icon name="arrow-left" size={26} />
          </button>
        </div>
        <div className="ep-locked">
          <Icon name="lock" size={64} style={{ color: '#9FB2C8' }} />
          <h1>«{e.title}»</h1>
          <p>
            Фрагмент откроется, когда вы пройдёте раздел {u.n} «{u.title}».
          </p>
          <button className="btn gold lg" onClick={() => navigate('learn')}>
            К урокам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cx('epic-player', playing && 'playing')}>
      <div className="ep-bg" />
      <OrnamentRing size={460} className="ep-sun" color="#F8B818" />
      <Mountains className="ep-mountains" colors={['#14467a', '#0f3866', '#0a2b52']} />
      <div className="ep-top">
        <button className="icon-btn light" onClick={() => navigate('epic')} aria-label="Назад">
          <Icon name="arrow-left" size={26} />
        </button>
        <span className="ep-tag">Эпос кай · Раздел {u.n}</span>
        <button className="icon-btn light" onClick={toggleMusic} aria-label={music ? 'Выключить музыку' : 'Включить музыку'} title="Музыкальное сопровождение">
          <Icon name={music ? 'music' : 'music-off'} size={24} />
        </button>
      </div>

      <div className="ep-main">
        <h1>«{e.title}»</h1>
        <p className="ep-src">
          {e.source}
          {e.performer && <> · {e.performer}</>}
        </p>
        <div className="ep-lines" ref={linesRef}>
          {line < 0 && <p className="ep-intro">{e.intro}</p>}
          {e.lines.map((l, i) => (
            <p key={i} className={cx('ep-line', i === line && 'cur', i < line && 'past', i > line && line >= 0 && 'future')}>
              {renderLine(l)}
            </p>
          ))}
          {ended && (
            <div className="ep-end rise">
              <Mascot pose="head" size={70} />
              <p>Сказание продолжается… Следующий фрагмент — в новом разделе.</p>
            </div>
          )}
        </div>
        <canvas ref={canvas} className="ep-viz" aria-hidden />
        <div className="ep-controls">
          <button className="ep-play" onClick={play} aria-label={playing ? 'Пауза' : 'Слушать'}>
            <Icon name={playing ? 'stop' : 'play'} size={34} />
          </button>
          <span className="ep-hint">{playing ? 'Звучит кай…' : ended ? 'Слушать ещё раз' : 'Слушать'}</span>
        </div>
        <div className="ep-words">
          <h3>Слова из сказания</h3>
          <div className="ep-word-list">
            {e.words.map((w) => (
              <div key={w.shor} className="ep-wl">
                <SpeakButton text={w.shor} size="sm" />
                <ShorText text={w.shor} />
                <span>{w.ru}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="ep-note">Музыка — синтез в браузере (горловой гул, комус, варган). Пересказ сюжета — для приложения, не перевод текста.</p>
      </div>
    </div>
  );
}
