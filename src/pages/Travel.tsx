import { useEffect, useState } from 'react';
import { PLACES, RIVERS, PHRASEBOOK, type Place } from '../data/travel';
import { UNITS } from '../data/course';
import { useStore, setState, getState, heartsNow } from '../state/store';
import { runAchievementCheck, ACHIEVEMENTS } from '../state/game';
import { Icon } from '../ui/Icon';
import { Mascot, Modal, ShorText, SpeakButton, toast } from '../ui/kit';
import { Mountains } from '../ui/Ornament';
import { navigate } from '../lib/router';
import { cx } from '../lib/util';
import { QR } from './ClassParts';
import { sfx } from '../audio/engine';

const BOX = { lat0: 52.25, lat1: 53.95, lon0: 86.9, lon1: 88.9 };
const W = 400;
const H = 470;
const px = (lat: number, lon: number): [number, number] => [((lon - BOX.lon0) / (BOX.lon1 - BOX.lon0)) * W, ((BOX.lat1 - lat) / (BOX.lat1 - BOX.lat0)) * H];
/* Смещение подписей, чтобы близкие места не наезжали друг на друга: [dx, dy, выравнивание] */
const LABEL: Record<string, [number, number, 'start' | 'middle' | 'end']> = {
  sheregesh: [-13, -2, 'end'],
  mustag: [14, 6, 'start'],
  ustkabyrza: [13, 18, 'start'],
  tashtagol: [-13, 5, 'end'],
  park: [0, 26, 'middle'],
  temirtau: [13, 5, 'start'],
};

function ShoriaMap({ onPick, visited, active }: { onPick: (p: Place) => void; visited: string[]; active?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="shoria-map" role="img" aria-label="Схема Горной Шории">
      <defs>
        <linearGradient id="mapbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--map-1)" />
          <stop offset="1" stopColor="var(--map-2)" />
        </linearGradient>
        <pattern id="trees" width="26" height="22" patternUnits="userSpaceOnUse">
          <path d="M6 18 L11 6 L16 18Z" fill="var(--map-tree)" />
        </pattern>
      </defs>
      <rect width={W} height={H} rx="22" fill="url(#mapbg)" />
      <path d="M40 470 C60 330 110 250 180 210 C250 170 320 190 400 140 L400 470Z" fill="url(#trees)" opacity=".7" />
      {/* горы */}
      {[
        [270, 300],
        [300, 330],
        [240, 340],
        [330, 280],
        [210, 380],
        [350, 360],
        [150, 300],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x - 22} ${y} L${x} ${y - 30} L${x + 22} ${y}Z`} fill="var(--map-mount)" opacity=".8" />
      ))}
      {RIVERS.map((r) => (
        <g key={r.id}>
          <polyline points={r.pts.map(([la, lo]) => px(la, lo).join(',')).join(' ')} fill="none" stroke="var(--map-river)" strokeWidth={r.id === 'tom' ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" />
          {(() => {
            const mid = r.pts[Math.floor(r.pts.length / 2)];
            const [x, y] = px(mid[0], mid[1]);
            return (
              <text x={x + 8} y={y - 6} className="map-river-label">
                {r.name}
              </text>
            );
          })()}
        </g>
      ))}
      {PLACES.filter((p) => p.kind !== 'river').map((p) => {
        const [x, y] = px(p.lat, p.lon);
        const v = visited.includes(p.id);
        return (
          <g key={p.id} className={cx('map-pin', v && 'visited', active === p.id && 'active')} transform={`translate(${x} ${y})`} onClick={() => onPick(p)} role="button" tabIndex={0} aria-label={p.name}>
            <circle r="16" className="pin-halo" />
            {p.kind === 'peak' ? (
              <path d="M-10 6 L0 -10 L10 6Z" className="pin-body" />
            ) : p.kind === 'park' ? (
              <path d="M-9 7 L0 -11 L9 7Z M-4 7 V11 H4 V7" className="pin-body" />
            ) : (
              <circle r="8" className="pin-body" />
            )}
            {p.kind === 'resort' && <text y="4" textAnchor="middle" className="pin-emoji">⛷</text>}
            <text x={LABEL[p.id]?.[0] ?? 0} y={LABEL[p.id]?.[1] ?? -20} textAnchor={LABEL[p.id]?.[2] ?? 'middle'} className="map-label">
              {p.name.replace('Гора ', '').replace('Шорский национальный парк', 'Нацпарк')}
            </text>
          </g>
        );
      })}
      {PLACES.filter((p) => p.kind === 'river').map((p) => {
        const [x, y] = px(p.lat, p.lon);
        return (
          <g key={p.id} className={cx('map-pin river', visited.includes(p.id) && 'visited')} transform={`translate(${x} ${y})`} onClick={() => onPick(p)} role="button" tabIndex={0} aria-label={p.name}>
            <circle r="13" className="pin-halo" />
            <circle r="7" className="pin-body" />
          </g>
        );
      })}
      <g transform="translate(360 40)">
        <circle r="18" fill="var(--surface)" opacity=".85" />
        <path d="M0 -12 L5 4 L0 0 L-5 4Z" fill="var(--red)" />
        <text y="15" textAnchor="middle" className="map-label">
          С
        </text>
      </g>
    </svg>
  );
}

export default function Travel({ place }: { place?: string }) {
  const s = useStore((x) => x);
  const [open, setOpen] = useState<Place | null>(() => PLACES.find((p) => p.id === place) ?? null);
  const [tab, setTab] = useState(0);
  const unit = UNITS.find((u) => u.id === 'u11')!;
  const greet = UNITS[0].lessons[0];
  const course = [greet, ...unit.lessons];
  const doneN = course.filter((l) => s.lessons[l.id]?.done).length;

  useEffect(() => {
    if (place) setOpen(PLACES.find((p) => p.id === place) ?? null);
  }, [place]);

  const pick = (p: Place) => {
    sfx('select');
    setOpen(p);
    if (!getState().travel.visited.includes(p.id)) {
      setState((d) => {
        d.travel.visited.push(p.id);
      });
      runAchievementCheck().forEach((id) => {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        if (a) toast(`Достижение: ${a.title}`, { icon: a.icon, sub: a.desc });
      });
    }
  };

  const start = (lessonId: string, i: number) => {
    const st = getState();
    const prevDone = i === 0 || i === 1 || !!st.lessons[course[i - 1].id]?.done;
    if (!prevDone) {
      toast('Сначала пройдите предыдущий урок мини-курса', { icon: '🔒' });
      return;
    }
    if (st.settings.hearts && heartsNow(st) <= 0) {
      toast('Сердца закончились', { icon: '💔' });
      navigate('shop');
      return;
    }
    navigate('lesson/' + lessonId);
  };

  return (
    <div className="page travel wide-page">
      <section className="travel-hero">
        <div className="th-bg" />
        <Mountains className="th-mountains" />
        <div className="th-content">
          <span className="eyebrow light">Режим «Путешественник»</span>
          <h1>Горная Шория говорит по-шорски</h1>
          <p>Мини-курс первых слов для гостей Шерегеша и таёжных маршрутов: приветствия, дорога, погода и названия мест.</p>
        </div>
        <Mascot pose="hero" size={170} className="th-mascot" anim="bob" />
      </section>

      <section className="card mini-course">
        <div className="row">
          <h2 className="grow">Мини-курс «Чолчы»</h2>
          <span className="pill green">
            {doneN}/{course.length}
          </span>
        </div>
        <div className="mc-list">
          {course.map((l, i) => {
            const done = !!s.lessons[l.id]?.done;
            const unlocked = i <= 1 || !!s.lessons[course[i - 1].id]?.done;
            return (
              <button key={l.id} className={cx('mc-item', done && 'done', !unlocked && 'locked')} onClick={() => start(l.id, i)}>
                <span className="mc-num">{done ? <Icon name="check" size={20} /> : unlocked ? i + 1 : <Icon name="lock" size={18} />}</span>
                <span className="grow">
                  <b>{l.title}</b>
                  <small>{i === 0 ? 'Раздел «Эзен!»' : 'Раздел «Чолчы»'} · 5 минут</small>
                </span>
                <Icon name="chevron-right" size={20} />
              </button>
            );
          })}
        </div>
      </section>

      <div className="travel-grid">
        <section className="card map-card">
          <div className="row">
            <h2 className="grow">Карта Шории</h2>
            <span className="muted" style={{ fontWeight: 800, fontSize: 14 }}>
              открыто {s.travel.visited.length}/{PLACES.length}
            </span>
          </div>
          <p className="muted map-hint">Нажмите на место — узнаете, что значит его имя и какие шорские слова с ним связаны.</p>
          <ShoriaMap onPick={pick} visited={s.travel.visited} active={open?.id} />
          <div className="map-legend">
            <span>
              <i className="lg-dot town" /> город, посёлок
            </span>
            <span>
              <i className="lg-dot peak" /> вершина
            </span>
            <span>
              <i className="lg-dot river" /> река
            </span>
          </div>
        </section>

        <section className="card phrasebook">
          <h2>Разговорник</h2>
          <div className="chips-scroll">
            {PHRASEBOOK.map((c, i) => (
              <button key={c.title} className={cx('chip', tab === i && 'on')} onClick={() => setTab(i)}>
                {c.icon} {c.title}
              </button>
            ))}
          </div>
          <div className="pb-list">
            {PHRASEBOOK[tab].phrases.map((p) => (
              <div key={p.shor} className="pb-row">
                <SpeakButton text={p.shor} size="sm" />
                <div className="grow">
                  <ShorText text={p.shor} />
                  <small>{p.ru}</small>
                </div>
                <SpeakButton text={p.shor} size="sm" slow />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card qr-promo">
        <QR text={`${location.origin}${location.pathname}#/travel/place/mustag`} size={120} />
        <div className="grow">
          <h3>QR-коды на курорте</h3>
          <p className="muted">
            Такие коды можно разместить у подъёмников, на тропах и в гостиницах: гость сканирует — и сразу слышит шорское название места и его значение. Этот код открывает
            карточку горы Мустаг.
          </p>
        </div>
      </section>

      <Modal open={!!open} onClose={() => (setOpen(null), place && navigate('travel', true))}>
        {open && (
          <div className="place-card">
            <span className="eyebrow">{open.kind === 'river' ? 'Река' : open.kind === 'peak' ? 'Вершина' : open.kind === 'park' ? 'Нацпарк' : open.kind === 'resort' ? 'Курорт' : 'Место'}</span>
            <h2>{open.name}</h2>
            {open.shor && (
              <div className="row">
                <SpeakButton text={open.shor} size="sm" />
                <span>
                  по-шорски: <ShorText text={open.shor} />
                </span>
              </div>
            )}
            {open.meaning && <p className="place-meaning">{open.meaning}</p>}
            <p>{open.text}</p>
            {open.words && (
              <div className="col" style={{ gap: 8 }}>
                <span className="eyebrow">Слова</span>
                {open.words.map((w) => (
                  <div key={w.shor} className="gx">
                    <SpeakButton text={w.shor} size="sm" />
                    <div>
                      <ShorText text={w.shor} />
                      <small>{w.ru}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="place-qr">
              <QR text={`${location.origin}${location.pathname}#/travel/place/${open.id}`} size={96} />
              <small className="muted">QR-код этого места — для табличек на маршрутах</small>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
