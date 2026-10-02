import { useEffect, useState } from 'react';
import { useStore, setState } from '../state/store';
import { LEAGUES, leagueBoard, leagueZones, weekXp } from '../state/game';
import { Icon } from '../ui/Icon';
import { Avatar, Modal, Mascot, Confetti, toast } from '../ui/kit';
import { weekStart, addDays, parseDay, plural, cx, DAY } from '../lib/util';
import { navigate } from '../lib/router';
import { copyText } from '../lib/platform';
import { net, useServer } from '../net/client';
import { leagueNet, watchBoard } from '../net/league';
import { retryNow } from '../net';
import { SignupCard } from './Signup';

function timeLeft() {
  const end = parseDay(addDays(weekStart(), 7)).getTime();
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3600000);
  return d > 0 ? `${d} ${plural(d, ['день', 'дня', 'дней'])}` : `${h} ${plural(h, ['час', 'часа', 'часов'])}`;
}

interface Row {
  key: string;
  name: string;
  avatar: number;
  xp: number;
  me?: boolean;
}

function BoardList({ rows, tier }: { rows: Row[]; tier: number }) {
  const z = leagueZones(rows.length, tier);
  return (
    <ol className="board">
      {rows.map((r, i) => {
        const rank = i + 1;
        const down = z.down > 0 && rank > rows.length - z.down;
        const zone = rank <= z.up ? 'up' : down ? 'down' : '';
        return (
          <li key={r.key} className={cx('board-row', r.me && 'me', zone)}>
            {rank === z.up + 1 && z.up > 0 && <div className="zone-line up">▲ Зона повышения</div>}
            {z.down > 0 && rank === rows.length - z.down + 1 && <div className="zone-line down">▼ Зона понижения</div>}
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
  );
}

function EmptyWeek() {
  return (
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
  );
}

/** Без сервера: группа из учебных соперников на устройстве. */
function DemoBoard() {
  const s = useStore((x) => x);
  const board = leagueBoard(s);
  return (
    <>
      {weekXp(s) === 0 && <EmptyWeek />}
      <BoardList rows={board.map((r, i) => ({ key: r.name + i, name: r.name, avatar: r.avatar, xp: r.xp, me: r.me }))} tier={s.league.tier} />
    </>
  );
}

/** С сервером: настоящая группа, обновляется у всех сразу. */
function OnlineBoard() {
  const s = useStore((x) => x);
  const n = net.use();
  const lg = leagueNet.use();
  const myXp = weekXp(s);
  const active = n.status === 'online' && myXp > 0;
  useEffect(() => (active ? watchBoard() : undefined), [active]);

  if (n.status === 'offline' && !lg.rows.length) {
    return (
      <div className="league-empty card">
        <Mascot pose="head" size={80} />
        <div className="grow">
          <b>Нет связи с сервером</b>
          <p className="muted">Опыт сохраняется на устройстве и попадёт в таблицу, когда появится интернет.</p>
        </div>
        <button className="btn sm" onClick={retryNow}>
          Повторить
        </button>
      </div>
    );
  }
  if (myXp === 0) return <EmptyWeek />;
  if (!lg.rows.length) {
    return (
      <ol className="board">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="board-row skeleton" />
        ))}
      </ol>
    );
  }

  const rows: Row[] = lg.rows.map((r) => {
    const me = r.id === n.uid;
    return { key: r.id, name: me ? s.profile.name || r.name || 'Вы' : r.name || 'Ученик шорского', avatar: me ? s.profile.avatar : r.avatar, xp: me ? Math.max(r.xp, myXp) : r.xp, me };
  });
  rows.sort((a, b) => b.xp - a.xp);
  const invite = async () => {
    const ok = await copyText(`Учу шорский в «Тадаре» — присоединяйся к моей лиге: ${location.origin}${location.pathname}`);
    toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать', { icon: ok ? '🔗' : '⚠️', sub: ok ? 'Отправьте её друзьям' : undefined });
  };
  return (
    <>
      <SignupCard place="league" title="Соревнуйтесь с друзьями" text="Создайте аккаунт: место в лиге и прогресс сохранятся, а друзья найдут вас в таблице группы." />
      <div className="league-meta">
        <span className={cx('live-dot', lg.live && 'on')} />
        {lg.live ? 'Таблица обновляется сама' : n.status === 'offline' ? 'Нет связи — показана последняя таблица' : 'Таблица группы'}
        <span className="grow" />
        {rows.length} {plural(rows.length, ['участник', 'участника', 'участников'])}
      </div>
      <BoardList rows={rows} tier={s.league.tier} />
      {rows.length < 5 && (
        <div className="card flat league-invite">
          <Icon name="users" size={28} />
          <p className="grow">В группе пока мало людей — позовите друзей, с ними интереснее. Группу набирают до 30 человек.</p>
          <button className="btn sm ghost" onClick={invite}>
            <Icon name="copy" size={18} /> Ссылка
          </button>
        </div>
      )}
    </>
  );
}

export default function League() {
  const s = useStore((x) => x);
  const lg = LEAGUES[s.league.tier];
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const result = s.league.result && !s.league.result.seen ? s.league.result : null;
  const server = useServer();
  const seen = () =>
    setState((d) => {
      if (d.league.result) d.league.result.seen = true;
    });

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
          «{lg.name}» · Неделя закончится через {timeLeft()}. {server ? 'Лучшие в группе поднимутся в следующую лигу.' : 'Топ-5 поднимутся в следующую лигу.'}
        </p>
      </section>

      {server ? <OnlineBoard /> : <DemoBoard />}

      <Modal open={!!result} onClose={seen}>
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
            <button className="btn block" onClick={seen}>
              Вперёд
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
