import { useEffect, useMemo, useRef, useState } from 'react';
import { UNITS } from '../data/course';
import { ITEMS, ruShow } from '../data/vocab';
import { epicById } from '../data/epics';
import type { Unit } from '../data/types';
import { useStore, getState, heartsNow } from '../state/store';
import { unitNodes, nodeStatus, currentLessonId, unitProgress, openChest, claimEpic, practiceAvailable, type PathNode, type NodeStatus } from '../state/game';
import { Icon } from '../ui/Icon';
import { Mascot, Modal, ShorText, SpeakButton, Confetti, CountUp, toast } from '../ui/kit';
import { navigate } from '../lib/router';
import { cx, fmtDate } from '../lib/util';
import { sfx } from '../audio/engine';
import { OrnamentBand } from '../ui/Ornament';

const OFFSETS = [0, 46, 72, 46, 0, -46, -72, -46];

export default function Learn() {
  const s = useStore((x) => x);
  const current = currentLessonId(s);
  const [open, setOpen] = useState<string | null>(null);
  const [guide, setGuide] = useState<Unit | null>(null);
  const [chest, setChest] = useState<{ key: string; amount: number } | null>(null);
  const [reward, setReward] = useState<Unit | null>(null);
  const [showJump, setShowJump] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // после общего «прокрутить наверх» при смене экрана — к текущему уроку
    const t = setTimeout(() => {
      const el = currentRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.7) window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.42, behavior: 'auto' });
    }, 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = currentRef.current;
      if (!el) return setShowJump(false);
      const r = el.getBoundingClientRect();
      setShowJump(r.top < -40 || r.top > window.innerHeight);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.node-wrap')) setOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const assignment = useMemo(() => {
    const j = s.cls.joined;
    if (!j) return undefined;
    const list = s.cls.myClass && j.code === s.cls.myClass.code ? s.cls.myClass.assignments : j.assignments ?? [];
    return list.find((x) => !s.lessons[x.lessonId]?.done);
  }, [s.cls, s.lessons]);

  const startLesson = (lessonId: string) => {
    const st = getState();
    if (st.settings.hearts && heartsNow(st) <= 0) {
      toast('Сердца закончились', { icon: '💔', sub: 'Пройдите тренировку или загляните в лавку' });
      navigate('shop');
      return;
    }
    sfx('tap');
    navigate('lesson/' + lessonId);
  };

  const onChest = (n: PathNode) => {
    const amount = openChest(n.key);
    sfx('chest');
    setChest({ key: n.key, amount });
    setOpen(null);
  };

  const onEpic = (n: PathNode, status: NodeStatus) => {
    setOpen(null);
    if (status === 'done') {
      navigate('epic/' + n.unit.epicId);
      return;
    }
    claimEpic(n.unit.id);
    sfx('complete');
    setReward(n.unit);
  };

  return (
    <div className="learn">
      {assignment && (
        <div className="assign-banner rise">
          <Icon name="school" size={36} />
          <div className="grow">
            <b>Задание учителя</b>
            <p>
              Урок «{UNITS.flatMap((u) => u.lessons).find((l) => l.id === assignment.lessonId)?.title}» до {fmtDate(assignment.due)}
            </p>
          </div>
          <button className="btn sm" onClick={() => startLesson(assignment.lessonId)}>
            Начать
          </button>
        </div>
      )}
      {s.settings.mode === 'traveler' && (
        <button className="travel-banner rise" onClick={() => navigate('travel')}>
          <Icon name="travel" size={36} />
          <span className="grow">
            <b>Режим «Путешественник»</b>
            <small>Мини-курс первых слов, разговорник и карта Горной Шории</small>
          </span>
          <Icon name="chevron-right" size={22} />
        </button>
      )}

      {UNITS.map((u, ui) => {
        const nodes = unitNodes(u);
        const prog = unitProgress(s, u);
        const mascotTop = 70;
        return (
          <section key={u.id} className="unit" style={{ ['--uc' as string]: u.color, ['--ucd' as string]: u.colorDark, ['--uink' as string]: u.ink ?? '#fff' }}>
            <header className="unit-banner">
              <div className="grow">
                <div className="ub-eyebrow">
                  Раздел {u.n} · {prog.done}/{prog.total}
                </div>
                <h2>
                  <ShorText text={u.shorTitle} /> <span className="ub-ru">· {u.title}</span>
                </h2>
              </div>
              <button className="btn ub-guide" onClick={() => setGuide(u)}>
                <Icon name="book" size={22} />
                <span>Справочник</span>
              </button>
            </header>
            <p className="unit-sub">{u.subtitle}</p>
            <div className="path">
              {nodes.map((n, i) => {
                const status = nodeStatus(s, n, current);
                const off = OFFSETS[i % OFFSETS.length] * (ui % 2 ? -1 : 1);
                const isCur = status === 'current';
                return (
                  <div
                    key={n.key}
                    className={cx('path-row', open === n.key && 'raised', (isCur || (n.kind === 'epic' && status === 'available')) && 'cur-row')}
                    style={{ transform: `translateX(${off}px)`, ['--off' as string]: `${off}px` }}
                    ref={isCur ? currentRef : undefined}
                  >
                    <PathNodeView
                      node={n}
                      status={status}
                      open={open === n.key}
                      onToggle={() => {
                        sfx('select');
                        setOpen(open === n.key ? null : n.key);
                      }}
                      onStart={startLesson}
                      onChest={() => onChest(n)}
                      onEpic={() => onEpic(n, status)}
                    />
                  </div>
                );
              })}
              <div className={cx('path-mascot', ui % 2 ? 'right' : 'left')} style={{ top: mascotTop }}>
                <Mascot pose={ui % 2 ? 'point' : 'point-r'} size={130} anim={ui % 3 === 0 ? 'bob' : 'sway'} />
              </div>
            </div>
            {ui < UNITS.length - 1 && (
              <div className="unit-divider">
                <OrnamentBand color="var(--line-2)" height={18} />
              </div>
            )}
          </section>
        );
      })}

      <div className="path-end">
        <Mascot pose="hero" size={170} anim="bob" />
        <p>
          Это весь курс MVP. Дальше — больше 100 уроков, проверка произношения и телеутский язык.
        </p>
      </div>

      <div className="fabs">
        {practiceAvailable(s) && (
          <button className="fab practice" onClick={() => navigate('practice')} title="Тренировка слабых слов" aria-label="Тренировка">
            <Icon name="dumbbell" size={26} />
          </button>
        )}
        {showJump && (
          <button className="fab jump" onClick={() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} aria-label="К текущему уроку">
            <Icon name="arrow-left" size={24} style={{ transform: 'rotate(90deg)' }} />
          </button>
        )}
      </div>

      <GuideModal unit={guide} onClose={() => setGuide(null)} />
      <Modal open={!!chest} onClose={() => setChest(null)}>
        {chest && (
          <div className="center col" style={{ alignItems: 'center' }}>
            <Confetti />
            <div className="chest-anim">
              <Icon name="chest-open" size={120} />
            </div>
            <h2>Сундук открыт!</h2>
            <p className="big-reward">
              +<CountUp to={chest.amount} /> <Icon name="nut" size={34} />
            </p>
            <p className="muted">Кедровые орешки можно потратить в лавке.</p>
            <button className="btn block" onClick={() => setChest(null)}>
              Отлично
            </button>
          </div>
        )}
      </Modal>
      <EpicReward unit={reward} onClose={() => setReward(null)} />
    </div>
  );
}

function PathNodeView({
  node,
  status,
  open,
  onToggle,
  onStart,
  onChest,
  onEpic,
}: {
  node: PathNode;
  status: NodeStatus;
  open: boolean;
  onToggle: () => void;
  onStart: (id: string) => void;
  onChest: () => void;
  onEpic: () => void;
}) {
  const u = node.unit;
  let icon;
  if (node.kind === 'lesson') icon = status === 'done' ? <Icon name="check" size={34} /> : status === 'current' ? <Icon name="star" size={36} /> : <Icon name="lock" size={30} />;
  else if (node.kind === 'chest') icon = <Icon name={status === 'done' ? 'chest-open' : 'chest'} size={60} />;
  else icon = <Icon name="kai" size={44} />;
  const label =
    node.kind === 'lesson'
      ? `Урок ${node.lessonIndex! + 1}: ${node.lesson!.title}`
      : node.kind === 'chest'
        ? 'Сундук с орешками'
        : `Эпос кай: ${epicById(u.epicId)?.title}`;
  return (
    <div className="node-wrap">
      {status === 'current' && (
        <div className="start-bubble" aria-hidden>
          Начать
        </div>
      )}
      {node.kind === 'epic' && status === 'available' && (
        <div className="start-bubble gold" aria-hidden>
          Эпос!
        </div>
      )}
      <button className={cx('node', 'k-' + node.kind, status)} onClick={onToggle} aria-label={label} aria-expanded={open}>
        {status === 'current' && <span className="node-ring" />}
        <span className="node-face">{icon}</span>
      </button>
      {open && (
        <div className={cx('node-pop', status === 'locked' && 'locked')}>
          {node.kind === 'lesson' && (
            <>
              <b>{node.lesson!.title}</b>
              <small>
                Урок {node.lessonIndex! + 1} из {u.lessons.length} · {node.lesson!.items.length} новых слов
              </small>
              <p className="np-words">
                {node.lesson!.items.slice(0, 6).map((id) => (
                  <span key={id}>
                    <ShorText text={ITEMS[id].shor} /> — {ruShow(ITEMS[id])}
                  </span>
                ))}
              </p>
              {status === 'locked' ? (
                <p className="np-lock">Пройдите все уроки выше, чтобы открыть этот.</p>
              ) : (
                <button className="btn white block" onClick={() => onStart(node.lesson!.id)}>
                  {status === 'done' ? 'Повторить · +5 опыта' : 'Начать · +10 опыта'}
                </button>
              )}
            </>
          )}
          {node.kind === 'chest' && (
            <>
              <b>Сундук с орешками</b>
              {status === 'locked' && <p className="np-lock">Откроется после второго урока раздела.</p>}
              {status === 'available' && (
                <button className="btn white block" onClick={onChest}>
                  Открыть
                </button>
              )}
              {status === 'done' && <small>Уже открыт — орешки ваши.</small>}
            </>
          )}
          {node.kind === 'epic' && (
            <>
              <b>Эпос кай · награда</b>
              <small>«{epicById(u.epicId)?.title}»</small>
              {status === 'locked' && <p className="np-lock">Пройдите все уроки раздела — откроется фрагмент эпоса и +50 опыта.</p>}
              {status !== 'locked' && (
                <button className="btn white block" onClick={onEpic}>
                  {status === 'done' ? 'Слушать снова' : 'Получить награду'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function GuideModal({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  if (!unit) return null;
  const words = unit.lessons.flatMap((l) => l.items).map((id) => ITEMS[id]);
  return (
    <Modal open={!!unit} onClose={onClose} wide>
      <div className="guide">
        <div className="guide-head" style={{ background: unit.color, color: unit.ink ?? '#fff' }}>
          <div>
            <div className="ub-eyebrow">Справочник · Раздел {unit.n}</div>
            <h2 style={{ color: 'inherit' }}>
              <ShorText text={unit.shorTitle} /> · {unit.title}
            </h2>
          </div>
          <Mascot pose="head" size={84} />
        </div>
        {unit.guide.map((g) => (
          <div key={g.title} className="guide-sec">
            <h3>{g.title}</h3>
            <p>{g.text}</p>
            {g.examples && (
              <div className="guide-ex">
                {g.examples.map((ex) => (
                  <div key={ex.shor} className="gx">
                    <SpeakButton text={ex.shor.split('→').pop()!.trim()} size="sm" />
                    <div>
                      <ShorText text={ex.shor} />
                      <small>{ex.ru}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="guide-sec">
          <h3>Слова раздела</h3>
          <div className="guide-words">
            {words.map((w) => (
              <div key={w.id} className="gw">
                <SpeakButton text={w.shor} size="sm" />
                <ShorText text={w.shor} />
                <span className="muted">{ruShow(w)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EpicReward({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  if (!unit) return null;
  const e = epicById(unit.epicId)!;
  return (
    <Modal open={!!unit} onClose={onClose}>
      <Confetti />
      <div className="reward center">
        <Mascot pose="hero" size={180} anim="jump" />
        <h2>Раздел пройден!</h2>
        <span className="pill gold xp-pill">+50 опыта · +20 орешков</span>
        <div className="reward-epic">
          <div className="eyebrow" style={{ color: 'var(--blue-dd)' }}>
            Открыт фрагмент эпоса
          </div>
          <div className="row">
            <span className="play-dot">
              <Icon name="play" size={20} />
            </span>
            <div className="wave">
              {Array.from({ length: 16 }).map((_, i) => (
                <i key={i} style={{ height: 6 + ((i * 7) % 22), animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          </div>
          <b>«{e.title}»</b>
        </div>
        <button
          className="btn block"
          onClick={() => {
            onClose();
            navigate('epic/' + e.id);
          }}
        >
          Слушать
        </button>
        <button className="btn text block" onClick={onClose}>
          Позже
        </button>
      </div>
    </Modal>
  );
}
