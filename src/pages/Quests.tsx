import { useEffect, useState } from 'react';
import { useStore, setState } from '../state/store';
import { questDef, claimQuest, ensureQuests, ACHIEVEMENTS } from '../state/game';
import { Icon, type IconName } from '../ui/Icon';
import { Modal, Confetti, CountUp, Mascot } from '../ui/kit';
import { cx, dayKey, plural } from '../lib/util';
import { sfx } from '../audio/engine';
import { PageHead } from '../layout/Layout';

function untilMidnight() {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - d.getTime();
  const h = Math.floor(m / 3600000);
  return h > 0 ? `${h} ${plural(h, ['час', 'часа', 'часов'])}` : `${Math.ceil(m / 60000)} мин`;
}

export default function Quests() {
  const s = useStore((x) => x);
  const [claimed, setClaimed] = useState<number | null>(null);
  useEffect(() => {
    if (s.quests.day !== dayKey()) setState((d) => ensureQuests(d));
  }, [s.quests.day]);
  const doneCount = s.quests.ids.filter((id) => (s.quests.progress[id] ?? 0) >= questDef(id).target).length;

  return (
    <div className="page quests">
      <PageHead title="Задания" sub={`Новые задания через ${untilMidnight()}`} icon="quests" />
      <section className="quest-hero">
        <div className="grow">
          <h2>Задания дня</h2>
          <p>Выполняйте задания — получайте сундуки с кедровыми орешками.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="bar gold grow">
              <i style={{ width: `${(doneCount / Math.max(1, s.quests.ids.length)) * 100}%` }} />
            </div>
            <b>
              {doneCount}/{s.quests.ids.length}
            </b>
          </div>
        </div>
        <Mascot pose="hero-l" size={130} />
      </section>

      <div className="quest-list">
        {s.quests.ids.map((id) => {
          const q = questDef(id);
          const p = s.quests.progress[id] ?? 0;
          const done = p >= q.target;
          const got = s.quests.claimed[id];
          return (
            <div key={id} className={cx('quest card', done && 'done')}>
              <Icon name={q.icon as IconName} size={40} />
              <div className="grow">
                <b>{q.title}</b>
                <div className="row" style={{ gap: 10, marginTop: 6 }}>
                  <div className="bar gold grow">
                    <i style={{ width: `${(p / q.target) * 100}%` }} />
                  </div>
                  <small className="muted">
                    {p}/{q.target}
                  </small>
                </div>
              </div>
              {got ? (
                <span className="quest-got">
                  <Icon name="chest-open" size={40} />
                </span>
              ) : (
                <button
                  className={cx('quest-chest', done && 'ready')}
                  disabled={!done}
                  onClick={() => {
                    const r = claimQuest(id);
                    if (r) {
                      sfx('chest');
                      setClaimed(r);
                    }
                  }}
                  aria-label={done ? 'Забрать награду' : `Награда: ${q.reward} орешков`}
                >
                  <Icon name="chest" size={40} />
                  <small>
                    {q.reward} <Icon name="nut" size={14} />
                  </small>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="sec-title">Достижения</h2>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const got = s.ach[a.id];
          return (
            <div key={a.id} className={cx('ach', got ? 'got' : 'locked')}>
              <span className="ach-icon">{a.icon}</span>
              <b>{a.title}</b>
              <small>{a.desc}</small>
            </div>
          );
        })}
      </div>

      <Modal open={claimed !== null} onClose={() => setClaimed(null)}>
        <div className="center col" style={{ alignItems: 'center' }}>
          <Confetti />
          <div className="chest-anim">
            <Icon name="chest-open" size={120} />
          </div>
          <h2>Награда получена!</h2>
          <p className="big-reward">
            +<CountUp to={claimed ?? 0} /> <Icon name="nut" size={34} />
          </p>
          <button className="btn block" onClick={() => setClaimed(null)}>
            Отлично
          </button>
        </div>
      </Modal>
    </div>
  );
}
