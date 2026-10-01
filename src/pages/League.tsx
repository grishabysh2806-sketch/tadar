import { useEffect, useState } from 'react';
import { useStore, setState } from '../state/store';
import { LEAGUES, leagueBoard, weekXp } from '../state/game';
import { Icon } from '../ui/Icon';
import { Avatar, Modal, Mascot, Confetti } from '../ui/kit';
import { weekStart, addDays, parseDay, plural, cx, DAY } from '../lib/util';
import { navigate } from '../lib/router';

function timeLeft() {
  const end = parseDay(addDays(weekStart(), 7)).getTime();
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3600000);
  return d > 0 ? `${d} ${plural(d, ['день', 'дня', 'дней'])}` : `${h} ${plural(h, ['час', 'часа', 'часов'])}`;
}

export default function League() {
  const s = useStore((x) => x);
  const lg = LEAGUES[s.league.tier];
  const board = leagueBoard(s);
  const myXp = weekXp(s);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const result = s.league.result && !s.league.result.seen ? s.league.result : null;

  return (
    <div className="page league">
      <section className="league-hero">
        <div className="lh-badges">
          {LEAGUES.map((l, i) => (
            <span key={l.name} className={cx('lh-badge', i === s.league.tier && 'cur', i > s.league.tier && 'locked')} style={{ background: i > s.league.tier ? undefined : l.color, color: l.ink }} title={l.ru}>
              <Icon name={i > s.league.tier ? 'lock' : 'league'} size={i === s.league.tier ? 46 : 26} />
            </span>
          ))}
        </div>
        <h1>{lg.ru}</h1>
        <p className="muted">
          «{lg.name}» · Неделя закончится через {timeLeft()}. Топ-5 поднимутся в следующую лигу.
        </p>
      </section>

      {myXp === 0 && (
        <div className="league-empty card">
          <Mascot pose="head" size={80} />
          <div className="grow">
            <b>Вы ещё не в таблице этой недели</b>
            <p className="muted">Пройдите любой урок — и соревнуйтесь с другими учениками шорского.</p>
          </div>
          <button className="btn sm" onClick={() => navigate('learn')}>
            Урок
          </button>
        </div>
      )}

      <ol className="board">
        {board.map((r, i) => {
          const rank = i + 1;
          const zone = rank <= 5 ? 'up' : rank >= 16 && s.league.tier > 0 ? 'down' : '';
          return (
            <li key={r.name + i} className={cx('board-row', r.me && 'me', zone)}>
              {rank === 6 && <div className="zone-line up">▲ Зона повышения</div>}
              {rank === 16 && s.league.tier > 0 && <div className="zone-line down">▼ Зона понижения</div>}
              <span className={cx('rank', rank <= 3 && `top${rank}`)}>{rank <= 3 ? <Icon name="league" size={28} /> : rank}</span>
              <Avatar name={r.name} idx={r.avatar} size={42} />
              <span className="grow b-name">
                {r.name}
                {r.me && <small> (вы)</small>}
              </span>
              <b className="b-xp">{r.xp} опыта</b>
            </li>
          );
        })}
      </ol>

      <Modal
        open={!!result}
        onClose={() =>
          setState((d) => {
            if (d.league.result) d.league.result.seen = true;
          })
        }
      >
        {result && (
          <div className="center col" style={{ alignItems: 'center' }}>
            {result.to > result.from && <Confetti />}
            <span className="league-badge big" style={{ background: LEAGUES[result.to].color, color: LEAGUES[result.to].ink }}>
              <Icon name="league" size={64} />
            </span>
            <h2>{result.to > result.from ? 'Повышение!' : result.to < result.from ? 'Лига понижена' : 'Неделя завершена'}</h2>
            <p className="muted">
              Вы заняли {result.rank}-е место. {result.to !== result.from ? `Теперь вы в лиге «${LEAGUES[result.to].name}».` : 'Вы остаётесь в своей лиге.'}
            </p>
            <button
              className="btn block"
              onClick={() =>
                setState((d) => {
                  if (d.league.result) d.league.result.seen = true;
                })
              }
            >
              Вперёд
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
