import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { Modal, Mascot, Avatar } from '../ui/kit';
import { navigate, useRoute } from '../lib/router';
import { useStore, heartsNow, nextHeartIn, streakNow, xpToday, MAX_HEARTS } from '../state/store';
import { LEAGUES, leagueBoard, leagueZones, weekXp, ensureQuests, questDef, practiceAvailable } from '../state/game';
import { net, useServer } from '../net/client';
import { leagueNet, refreshBoardIfOld } from '../net/league';
import { setState } from '../state/store';
import { cx, dayKey, addDays, plural, weekStart } from '../lib/util';
import { OrnamentBand } from '../ui/Ornament';

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
}
export const NAV: NavItem[] = [
  { id: 'learn', label: 'Учиться', icon: 'learn' },
  { id: 'epic', label: 'Эпос кай', icon: 'kai' },
  { id: 'voices', label: 'Голоса старших', icon: 'voices' },
  { id: 'league', label: 'Лига', icon: 'league' },
  { id: 'quests', label: 'Задания', icon: 'quests' },
  { id: 'shop', label: 'Лавка', icon: 'shop' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
];
export const MORE: NavItem[] = [
  { id: 'dictionary', label: 'Словарь', icon: 'book' },
  { id: 'alphabet', label: 'Алфавит и звуки', icon: 'abc' },
  { id: 'class', label: 'Режим «Класс»', icon: 'school' },
  { id: 'travel', label: 'Путешественник', icon: 'travel' },
  { id: 'settings', label: 'Настройки', icon: 'settings' },
  { id: 'about', label: 'О проекте', icon: 'info' },
];

export function Logo({ light }: { light?: boolean }) {
  return (
    <button className={cx('logo', light && 'light')} onClick={() => navigate('learn')} aria-label="Тадар — на главную">
      <span className="logo-mark">
        <svg viewBox="0 0 40 48" width="22" height="26" aria-hidden>
          <path
            d="M20 44V20 M20 20C20 11 12 6.5 7.5 10.5 4.5 13.3 6.5 18.5 10.8 17.6 13.4 17 13.4 13.6 11.3 13.1 M20 20C20 11 28 6.5 32.5 10.5 35.5 13.3 33.5 18.5 29.2 17.6 26.6 17 26.6 13.6 28.7 13.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="4.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="logo-word">тадар</span>
    </button>
  );
}

function Sidebar() {
  const { main } = useRoute();
  const [more, setMore] = useState(false);
  const isMore = MORE.some((m) => m.id === main);
  return (
    <nav className="sidebar" aria-label="Главное меню">
      <Logo />
      <div className="nav-list">
        {NAV.map((n) => (
          <button key={n.id} className={cx('nav-item', main === n.id && 'active')} onClick={() => navigate(n.id)}>
            <Icon name={n.icon} size={30} />
            <span>{n.label}</span>
          </button>
        ))}
        <div className="more-wrap">
          <button className={cx('nav-item', (more || isMore) && 'active')} onClick={() => setMore((v) => !v)} aria-expanded={more}>
            <Icon name="more" size={30} />
            <span>Ещё</span>
          </button>
          {more && (
            <div className="more-pop" onMouseLeave={() => setMore(false)}>
              {MORE.map((m) => (
                <button
                  key={m.id}
                  className={cx('more-item', main === m.id && 'active')}
                  onClick={() => {
                    setMore(false);
                    navigate(m.id);
                  }}
                >
                  <Icon name={m.icon} size={26} />
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function BottomNav() {
  const { main } = useRoute();
  const [sheet, setSheet] = useState(false);
  const items = NAV.slice(0, 4);
  const rest = [...NAV.slice(4), ...MORE];
  const inRest = rest.some((r) => r.id === main);
  return (
    <>
      <nav className="bottom-nav" aria-label="Меню">
        {items.map((n) => (
          <button key={n.id} className={cx('bn-item', main === n.id && 'active')} onClick={() => navigate(n.id)} aria-label={n.label}>
            <Icon name={n.icon} size={30} />
          </button>
        ))}
        <button className={cx('bn-item', inRest && 'active')} onClick={() => setSheet(true)} aria-label="Ещё">
          <Icon name="more" size={30} />
        </button>
      </nav>
      <Modal open={sheet} onClose={() => setSheet(false)} sheet>
        <div className="sheet-grid">
          {rest.map((m) => (
            <button
              key={m.id}
              className={cx('sheet-item', main === m.id && 'active')}
              onClick={() => {
                setSheet(false);
                navigate(m.id);
              }}
            >
              <Icon name={m.icon} size={34} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

/* ── Счётчики: серия, орешки, сердца ─────────────────────────── */

function usePop() {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return { open, setOpen, ref };
}

export function WeekFlames({ compact }: { compact?: boolean }) {
  const s = useStore((x) => x);
  const today = dayKey();
  const ws = weekStart();
  const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return (
    <div className={cx('week-flames', compact && 'compact')}>
      {names.map((n, i) => {
        const d = addDays(ws, i);
        const active = (s.xpDays[d] ?? 0) > 0;
        const frozen = s.streak.frozen.includes(d);
        return (
          <div key={n} className={cx('wf-day', d === today && 'today', active && 'on', frozen && 'frozen')}>
            <span>{n}</span>
            <i>{active ? <Icon name="flame" size={22} /> : frozen ? <Icon name="freeze" size={20} /> : <b />}</i>
          </div>
        );
      })}
    </div>
  );
}

export function StatBar({ inRail }: { inRail?: boolean }) {
  const s = useStore((x) => x);
  const { open, setOpen, ref } = usePop();
  const streak = streakNow(s);
  const doneToday = (s.xpDays[dayKey()] ?? 0) > 0;
  const hearts = heartsNow(s);
  const toggle = (k: string) => setOpen(open === k ? null : k);
  const [, force] = useState(0);
  useEffect(() => {
    if (hearts >= MAX_HEARTS) return;
    const t = setInterval(() => force((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [hearts]);
  const mins = Math.ceil(nextHeartIn(s) / 60000);
  return (
    <div className={cx('statbar', inRail && 'in-rail')} ref={ref}>
      <button className={cx('stat', 'mode-chip')} onClick={() => navigate('settings')} title="Курс: шорский язык">
        <span className="flag">
          <svg viewBox="0 0 40 48" width="16" height="19" aria-hidden>
            <path
              d="M20 44V20 M20 20C20 11 12 6.5 7.5 10.5 4.5 13.3 6.5 18.5 10.8 17.6 13.4 17 13.4 13.6 11.3 13.1 M20 20C20 11 28 6.5 32.5 10.5 35.5 13.3 33.5 18.5 29.2 17.6 26.6 17 26.6 13.6 28.7 13.1"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="mode-label">{s.settings.mode === 'class' ? 'Класс' : s.settings.mode === 'traveler' ? 'Путешественник' : 'Шорский'}</span>
      </button>
      <button className={cx('stat', 'streak', doneToday && 'lit')} onClick={() => toggle('streak')} aria-label={`Серия: ${streak}`}>
        <Icon name={doneToday ? 'flame' : 'flame-off'} size={26} />
        <b>{streak}</b>
      </button>
      <button className="stat nuts" onClick={() => toggle('nuts')} aria-label={`Орешки: ${s.nuts}`}>
        <Icon name="nut" size={26} />
        <b>{s.nuts}</b>
      </button>
      <button className="stat hearts" onClick={() => toggle('hearts')} aria-label={`Сердца: ${hearts}`}>
        <Icon name={hearts > 0 ? 'heart' : 'heart-off'} size={26} />
        <b>{s.settings.hearts ? hearts : '∞'}</b>
      </button>

      {open === 'streak' && (
        <div className="pop">
          <div className="pop-head gold">
            <div>
              <h3>
                {streak} {plural(streak, ['день', 'дня', 'дней'])} подряд
              </h3>
              <p>{doneToday ? 'Сегодня вы уже занимались — огонь горит!' : 'Пройдите урок сегодня, чтобы не погасить огонь.'}</p>
            </div>
            <Icon name="flame" size={56} />
          </div>
          <WeekFlames />
          <div className="pop-foot">
            <span className="pill blue">
              <Icon name="freeze" size={16} /> Заморозки: {s.streak.freezes}
            </span>
            <span className="pill gold">Рекорд: {s.streak.best}</span>
          </div>
        </div>
      )}
      {open === 'nuts' && (
        <div className="pop">
          <div className="pop-head brown">
            <div>
              <h3>{s.nuts} кедровых орешков</h3>
              <p>Қузуқ — кедровый орех. Орешки дают за уроки, задания и сундуки.</p>
            </div>
            <Icon name="nut" size={52} />
          </div>
          <button className="btn block" onClick={() => (setOpen(null), navigate('shop'))}>
            В лавку
          </button>
        </div>
      )}
      {open === 'hearts' && (
        <div className="pop">
          <div className="pop-head red">
            <div>
              <h3>{s.settings.hearts ? `Сердца: ${hearts} из ${MAX_HEARTS}` : 'Сердца без ограничений'}</h3>
              <p>
                {!s.settings.hearts
                  ? 'Ошибки не отнимают сердца — режим включается в настройках.'
                  : hearts >= MAX_HEARTS
                    ? 'Все сердца на месте. За ошибку в уроке сердце теряется.'
                    : `Новое сердце через ${mins} ${plural(mins, ['минуту', 'минуты', 'минут'])}. Тренировка тоже возвращает сердце.`}
              </p>
            </div>
            <Icon name="heart" size={52} />
          </div>
          {s.settings.hearts && hearts < MAX_HEARTS && (
            <div className="col">
              {practiceAvailable(s) && (
                <button className="btn green block" onClick={() => (setOpen(null), navigate('practice'))}>
                  Тренировка +1 сердце
                </button>
              )}
              <button className="btn ghost block" onClick={() => (setOpen(null), navigate('shop'))}>
                Восстановить за 350 <Icon name="nut" size={20} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Правая колонка ─────────────────────────────────────────── */

/** Место в лиге: группа с сервера или учебная группа на устройстве. */
function useLeaguePlace() {
  const s = useStore((x) => x);
  const n = net.use();
  const lgNet = leagueNet.use();
  const myXp = weekXp(s);
  const server = useServer();
  useEffect(() => {
    if (server && n.status === 'online' && myXp > 0) refreshBoardIfOld();
  }, [server, n.status, myXp]);
  if (!server) {
    const board = leagueBoard(s);
    const rank = board.findIndex((r) => r.me) + 1;
    return { rank, size: board.length, xp: board[rank - 1].xp };
  }
  if (myXp <= 0) return { rank: 0, size: 0, xp: 0 };
  const rows = lgNet.rows.map((r) => (r.id === n.uid ? { ...r, xp: Math.max(r.xp, myXp) } : r)).sort((a, b) => b.xp - a.xp);
  const rank = rows.findIndex((r) => r.id === n.uid) + 1;
  return { rank, size: rows.length, xp: myXp };
}

function RailLeague() {
  const s = useStore((x) => x);
  const lg = LEAGUES[s.league.tier];
  const place = useLeaguePlace();
  const up = leagueZones(place.size, s.league.tier).up;
  return (
    <div className="card rail-card">
      <div className="row">
        <h3 className="grow">{lg.ru}</h3>
        <button className="btn text sm" onClick={() => navigate('league')}>
          Открыть
        </button>
      </div>
      <div className="row rail-league">
        <span className="league-badge" style={{ background: lg.color, color: lg.ink }}>
          <Icon name="league" size={36} />
        </span>
        <p>
          {place.xp > 0 && place.rank > 0 ? (
            <>
              Вы на <b>{place.rank}-м месте</b> из {place.size}. {up > 1 ? `Топ-${up} переходят в следующую лигу.` : up === 1 ? 'Лучший переходит в следующую лигу.' : 'Это высшая лига!'}
            </>
          ) : place.xp > 0 ? (
            <>Вы в таблице этой недели — откройте лигу, чтобы увидеть соперников.</>
          ) : (
            <>Пройдите урок, чтобы попасть в таблицу этой недели.</>
          )}
        </p>
      </div>
    </div>
  );
}

function RailQuests() {
  const s = useStore((x) => x);
  useEffect(() => {
    if (s.quests.day !== dayKey()) setState((d) => ensureQuests(d));
  }, [s.quests.day]);
  return (
    <div className="card rail-card">
      <div className="row">
        <h3 className="grow">Задания дня</h3>
        <button className="btn text sm" onClick={() => navigate('quests')}>
          Все
        </button>
      </div>
      <div className="col" style={{ gap: 14 }}>
        {s.quests.ids.map((id) => {
          const q = questDef(id);
          const p = s.quests.progress[id] ?? 0;
          return (
            <div key={id} className="rq">
              <Icon name={q.icon as IconName} size={28} />
              <div className="grow">
                <div className="rq-title">{q.title}</div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="bar gold sm grow">
                    <i style={{ width: `${(p / q.target) * 100}%` }} />
                  </div>
                  <small className="muted">
                    {p}/{q.target}
                  </small>
                </div>
              </div>
              <Icon name={s.quests.claimed[id] ? 'chest-open' : 'chest'} size={26} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RailGoal() {
  const s = useStore((x) => x);
  const today = xpToday(s);
  const goal = s.settings.goal;
  return (
    <div className="card rail-card goal-card">
      <div className="row">
        <Icon name="target" size={28} />
        <h3 className="grow">Цель на день</h3>
        <small className="muted">
          {Math.min(today, goal)}/{goal} опыта
        </small>
      </div>
      <div className="bar gold">
        <i style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
      </div>
    </div>
  );
}

function RailVoices() {
  return (
    <div className="card rail-card voices-promo">
      <div className="grow">
        <h3>Голоса старших</h3>
        <p className="muted">Запишите, как говорят по-шорски ваши бабушки и дедушки. Так растёт открытый аудиословарь.</p>
        <button className="btn sm" onClick={() => navigate('voices')}>
          <Icon name="mic" size={18} /> Записать
        </button>
      </div>
      <Mascot pose="head" size={84} />
    </div>
  );
}

function RightRail() {
  const { main } = useRoute();
  return (
    <aside className="rail">
      <StatBar inRail />
      <RailGoal />
      {main !== 'league' && <RailLeague />}
      {main !== 'quests' && <RailQuests />}
      {main !== 'voices' && <RailVoices />}
      <div className="rail-modes">
        <button className="card mode-mini" onClick={() => navigate('class')}>
          <Icon name="school" size={30} />
          <span>
            <b>Класс</b>
            <small>для учителей и школ</small>
          </span>
        </button>
        <button className="card mode-mini" onClick={() => navigate('travel')}>
          <Icon name="travel" size={30} />
          <span>
            <b>Путешественник</b>
            <small>для гостей Шории</small>
          </span>
        </button>
      </div>
      <footer className="rail-foot">
        <OrnamentBand color="var(--blue-line)" height={14} />
        <p>
          «Тадар» — чтобы шорский язык звучал в каждом телефоне. <button onClick={() => navigate('about')}>О проекте</button>
        </p>
      </footer>
    </aside>
  );
}

export function TopBar() {
  return (
    <header className="topbar">
      <StatBar />
    </header>
  );
}

export function Layout({ children, rail = true }: { children: ReactNode; rail?: boolean }) {
  return (
    <div className={cx('app', rail && 'with-rail')}>
      <Sidebar />
      <TopBar />
      <main className="main">{children}</main>
      {rail && <RightRail />}
      <BottomNav />
    </div>
  );
}

export function PageHead({ title, sub, icon, children }: { title: string; sub?: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className="page-head">
      {icon && <Icon name={icon} size={44} />}
      <div className="grow">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export { Avatar };
