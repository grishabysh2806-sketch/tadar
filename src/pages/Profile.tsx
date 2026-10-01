import { useState } from 'react';
import { useStore, setState, streakNow } from '../state/store';
import { LEAGUES, ACHIEVEMENTS, learnedCount, lessonsDone } from '../state/game';
import { TOTAL_LESSONS } from '../data/course';
import { Icon } from '../ui/Icon';
import { Avatar, Mascot } from '../ui/kit';
import { navigate } from '../lib/router';
import { cx, dayKey, fmtMonthYear, monthName, plural } from '../lib/util';
import { OrnamentRing } from '../ui/Ornament';

function Calendar() {
  const s = useStore((x) => x);
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const today = dayKey();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  return (
    <div className="card cal">
      <div className="row">
        <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Предыдущий месяц">
          <Icon name="arrow-left" size={20} />
        </button>
        <b className="grow center cal-title">
          {monthName(first.getMonth())} {first.getFullYear()}
        </b>
        <button className="icon-btn" disabled={offset >= 0} onClick={() => setOffset(Math.min(0, offset + 1))} aria-label="Следующий месяц">
          <Icon name="arrow-right" size={20} />
        </button>
      </div>
      <div className="cal-grid">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <span key={d} className="cal-dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = dayKey(d);
          const xp = s.xpDays[k] ?? 0;
          const frozen = s.streak.frozen.includes(k);
          return (
            <span key={i} className={cx('cal-day', xp > 0 && 'on', frozen && 'frozen', k === today && 'today', s.goalDays[k] && 'goal')} title={xp ? `${xp} опыта` : undefined}>
              {d.getDate()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Profile() {
  const s = useStore((x) => x);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(s.profile.name);
  const lg = LEAGUES[s.league.tier];
  const streak = streakNow(s);
  const got = ACHIEVEMENTS.filter((a) => s.ach[a.id]);
  const modeName = s.settings.mode === 'class' ? 'Класс' : s.settings.mode === 'traveler' ? 'Путешественник' : 'Ученик';
  return (
    <div className="page profile">
      <section className="profile-hero">
        <div className="ph-avatar">
          <OrnamentRing size={152} className="ph-ring" color="var(--blue)" />
          <Avatar name={s.profile.name || 'Т'} idx={s.profile.avatar} size={104} />
        </div>
        <div className="ph-info">
          {edit ? (
            <div className="row">
              <input className="input" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setState((d) => void (d.profile.name = name.trim())), setEdit(false))} />
              <button
                className="btn sm green"
                onClick={() => {
                  setState((d) => {
                    d.profile.name = name.trim();
                  });
                  setEdit(false);
                }}
              >
                OK
              </button>
            </div>
          ) : (
            <h1>
              {s.profile.name || 'Ученик шорского'}
              <button className="icon-btn" onClick={() => setEdit(true)} aria-label="Изменить имя">
                <Icon name="edit" size={20} />
              </button>
            </h1>
          )}
          <p className="muted">
            Учит шорский с {fmtMonthYear(s.profile.since)} · режим «{modeName}»
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn sm ghost" onClick={() => setState((d) => void (d.profile.avatar = (d.profile.avatar + 1) % 6))}>
              Сменить цвет
            </button>
            <button className="btn sm ghost" onClick={() => navigate('settings')}>
              <Icon name="settings" size={18} /> Настройки
            </button>
          </div>
        </div>
      </section>

      <h2 className="sec-title">Статистика</h2>
      <div className="stat-grid">
        <div className="stat-tile">
          <Icon name={streak ? 'flame' : 'flame-off'} size={34} />
          <div>
            <b>{streak}</b>
            <small>{plural(streak, ['день', 'дня', 'дней'])} подряд</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="bolt" size={34} />
          <div>
            <b>{s.xp}</b>
            <small>всего опыта</small>
          </div>
        </div>
        <div className="stat-tile">
          <span className="league-badge sm" style={{ background: lg.color, color: lg.ink }}>
            <Icon name="league" size={24} />
          </span>
          <div>
            <b>{lg.name}</b>
            <small>текущая лига</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="book" size={34} />
          <div>
            <b>{learnedCount(s)}</b>
            <small>слов выучено</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="learn" size={34} />
          <div>
            <b>
              {lessonsDone(s)}/{TOTAL_LESSONS}
            </b>
            <small>уроков пройдено</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="kai" size={34} />
          <div>
            <b>{Object.keys(s.epics).length}</b>
            <small>фрагментов эпоса</small>
          </div>
        </div>
      </div>

      <h2 className="sec-title">Календарь занятий</h2>
      <Calendar />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="sec-title">Достижения</h2>
        <span className="muted" style={{ fontWeight: 800 }}>
          {got.length}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={cx('ach', s.ach[a.id] ? 'got' : 'locked')}>
            <span className="ach-icon">{a.icon}</span>
            <b>{a.title}</b>
            <small>{a.desc}</small>
          </div>
        ))}
      </div>

      <div className="profile-foot card flat">
        <Mascot pose="head" size={64} />
        <p>
          «Тадар» — самоназвание шорцев. Спасибо, что учите язык вместе с нами! <button onClick={() => navigate('about')}>О проекте</button>
        </p>
      </div>
    </div>
  );
}
