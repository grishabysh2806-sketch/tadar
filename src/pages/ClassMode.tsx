import { useEffect, useState } from 'react';
import { useStore, setState, getState, type Assignment, type ClassRoom } from '../state/store';
import { LESSONS, lessonById } from '../data/course';
import { currentLessonId, weekXp, runAchievementCheck, ACHIEVEMENTS, lessonsDone } from '../state/game';
import { Icon } from '../ui/Icon';
import { Avatar, Mascot, Modal, toast, ShorText } from '../ui/kit';
import { navigate } from '../lib/router';
import { addDays, dayKey, fmtDate, rng, cx, plural, daysBetween } from '../lib/util';
import { PageHead } from '../layout/Layout';
import { useServer } from '../net/client';
import { QR, ClassPitch, NewTaskModal, joinUrl as makeJoinUrl, toCsv, copyTable, saveTable } from './ClassParts';
import { TeacherOnline, StudentOnline } from './ClassOnline';
import { Pic } from '../ui/Pic';

const CODE_CHARS = 'АБВГДЕКМНПРСТ23456789';
function makeCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

const NAMES = ['Айана К.', 'Тимур Ч.', 'Лиза Т.', 'Артём С.', 'Аяна М.', 'Вика Ш.', 'Санжар А.', 'Олег К.', 'Мария Т.', 'Даша Б.', 'Ильяс Ч.', 'Полина Н.', 'Никита Ю.', 'Алина К.'];

interface Student {
  name: string;
  avatar: number;
  xp: number;
  lessons: number;
  streak: number;
  acc: number;
  last: string;
  done: Record<string, boolean>;
  me?: boolean;
}

function demoStudents(cls: ClassRoom): Student[] {
  const r = rng('class-' + cls.code + dayKey().slice(0, 8));
  return NAMES.slice(0, 12).map((name, i) => {
    const diligence = 0.25 + r() * 0.75;
    const done: Record<string, boolean> = {};
    cls.assignments.forEach((a) => {
      const age = Math.max(0, daysBetween(dayKey(a.createdAt), dayKey()));
      done[a.id] = r() < diligence * Math.min(1, 0.35 + age * 0.25);
    });
    return {
      name,
      avatar: i % 6,
      xp: Math.round((diligence * 160 + r() * 60) / 5) * 5,
      lessons: Math.round(diligence * 18 + r() * 4),
      streak: Math.round(diligence * 9 * r()),
      acc: Math.round(70 + diligence * 25 + r() * 5),
      last: addDays(dayKey(), -Math.floor((1 - diligence) * 4 * r())),
      done,
    };
  });
}

export default function ClassMode() {
  const s = useStore((x) => x);
  const role = s.cls.role;
  const server = useServer();

  useEffect(() => {
    let pending = false;
    try {
      pending = !!sessionStorage.getItem('tadar.join');
    } catch {
      /* noop */
    }
    if (pending && !role) setState((d) => void (d.cls.role = 'student'));
  }, [role]);

  if (!role) {
    return (
      <div className="page classmode">
        <PageHead title="Режим «Класс»" sub="Для школ юга Кузбасса и будущих учителей шорского" icon="school" />
        <div className="role-pick">
          <button
            className="card role-card"
            onClick={() =>
              setState((d) => {
                d.cls.role = 'teacher';
                d.settings.mode = 'class';
              })
            }
          >
            <span className="role-emoji">
              <Pic e="🧑‍🏫" size={72} />
            </span>
            <b>Я учитель</b>
            <small>Создам класс, раздам задания и увижу прогресс учеников</small>
          </button>
          <button
            className="card role-card"
            onClick={() =>
              setState((d) => {
                d.cls.role = 'student';
                d.settings.mode = 'class';
              })
            }
          >
            <span className="role-emoji">
              <Pic e="🧑‍🎓" size={72} />
            </span>
            <b>Я ученик</b>
            <small>Вступлю в класс по коду учителя и буду выполнять задания</small>
          </button>
        </div>
        <ClassPitch online={server} />
      </div>
    );
  }
  if (server) return role === 'teacher' ? <TeacherOnline /> : <StudentOnline />;
  return role === 'teacher' ? <Teacher /> : <StudentView />;
}

function Teacher() {
  const s = useStore((x) => x);
  const cls = s.cls.myClass;
  const [name, setName] = useState('7 «Б»');
  const [school, setSchool] = useState('');
  const [newTask, setNewTask] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!cls) {
    return (
      <div className="page classmode">
        <PageHead title="Новый класс" sub="Учитель шорского языка" icon="school" />
        <div className="card col create-class">
          <label>
            <span className="label">Название класса</span>
            <input id="class-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span className="label">Школа</span>
            <input id="class-school" className="input" value={school} placeholder="Например: школа № 1, Таштагол" onChange={(e) => setSchool(e.target.value)} />
          </label>
          <button
            className="btn green lg"
            disabled={!name.trim()}
            onClick={() => {
              const code = makeCode();
              const first = currentLessonId(getState()) ?? 'u1l1';
              setState((d) => {
                d.cls.myClass = {
                  name: name.trim(),
                  school: school.trim(),
                  code,
                  createdAt: Date.now(),
                  assignments: [{ id: 'a' + Date.now(), lessonId: first, due: addDays(dayKey(), 5), createdAt: Date.now() - 2 * 86400000 }],
                };
              });
              runAchievementCheck().forEach((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id);
                if (a) toast(`Достижение: ${a.title}`, { icon: a.icon });
              });
              toast('Класс создан', { icon: '🏫', sub: `Код для учеников: ${code}` });
            }}
          >
            Создать класс
          </button>
          <button className="btn text" onClick={() => setState((d) => void (d.cls.role = undefined))}>
            Я не учитель
          </button>
        </div>
        <ClassPitch />
      </div>
    );
  }

  const students = demoStudents(cls);
  const meJoined = s.cls.joined?.code === cls.code;
  const all: Student[] = meJoined
    ? [
        ...students,
        {
          name: (s.profile.name || 'Вы') + ' (это устройство)',
          avatar: s.profile.avatar,
          xp: weekXp(s),
          lessons: lessonsDone(s),
          streak: s.streak.cur,
          acc: 100,
          last: dayKey(),
          done: Object.fromEntries(cls.assignments.map((a) => [a.id, !!s.lessons[a.lessonId]?.done])),
          me: true,
        },
      ]
    : students;
  const sorted = [...all].sort((a, b) => b.xp - a.xp);
  const joinUrl = makeJoinUrl(cls.code);
  const totalXp = all.reduce((a, b) => a + b.xp, 0);
  const avgAcc = Math.round(all.reduce((a, b) => a + b.acc, 0) / all.length);

  const exportCsv = () => {
    const head = ['Ученик', 'Опыт за неделю', 'Уроков', 'Серия', 'Точность %', 'Был(а)', ...cls.assignments.map((a) => lessonById(a.lessonId)?.lesson.title ?? a.lessonId)];
    const lines = sorted.map((st) => [st.name, st.xp, st.lessons, st.streak, st.acc, st.last, ...cls.assignments.map((a) => (st.done[a.id] ? 'да' : 'нет'))]);
    return toCsv([head, ...lines]);
  };
  const saveCsv = () => saveTable(cls.name, exportCsv());

  return (
    <div className="page classmode wide-page">
      <PageHead title={`Класс ${cls.name}`} sub={cls.school || 'Режим учителя'} icon="school">
        <button className="btn sm ghost" onClick={() => setState((d) => void (d.cls.role = 'student'))}>
          Как ученик
        </button>
      </PageHead>

      <section className="class-code card">
        <div className="grow">
          <span className="eyebrow">Код для учеников</span>
          <div className="code-big">{cls.code}</div>
          <p className="muted">Ученики вводят код в разделе «Класс» → «Я ученик» или сканируют QR-код.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn sm"
              onClick={() => {
                navigator.clipboard?.writeText(cls.code).then(
                  () => toast('Код скопирован', { icon: '📋' }),
                  () => toast(cls.code, { icon: '📋' }),
                );
              }}
            >
              <Icon name="copy" size={18} /> Копировать
            </button>
            <button className="btn sm ghost" onClick={() => setShowQr(true)}>
              <Icon name="qr" size={18} /> QR-код
            </button>
            {!meJoined && (
              <button
                className="btn sm ghost"
                onClick={() => {
                  setState((d) => {
                    d.cls.joined = { code: cls.code, name: cls.name, teacher: d.profile.name || 'Учитель', joinedAt: Date.now(), assignments: [] };
                  });
                  toast('Это устройство добавлено в класс', { icon: '🧑‍🎓', sub: 'Задания появятся на карте уроков' });
                }}
              >
                Добавить себя учеником
              </button>
            )}
          </div>
        </div>
        <QR text={joinUrl} size={140} />
      </section>

      <div className="class-stats">
        <div className="stat-tile">
          <Icon name="users" size={30} style={{ color: 'var(--blue)' }} />
          <div>
            <b>{all.length}</b>
            <small>{plural(all.length, ['ученик', 'ученика', 'учеников'])}</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="bolt" size={30} />
          <div>
            <b>{totalXp}</b>
            <small>опыта за неделю</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="target" size={30} />
          <div>
            <b>{avgAcc}%</b>
            <small>средняя точность</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="book" size={30} />
          <div>
            <b>{cls.assignments.length}</b>
            <small>{plural(cls.assignments.length, ['задание', 'задания', 'заданий'])}</small>
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <h2 className="sec-title">Задания</h2>
        <button className="btn sm green" onClick={() => setNewTask(true)}>
          <Icon name="plus" size={18} /> Новое задание
        </button>
      </div>
      <div className="assign-list">
        {cls.assignments.length === 0 && <p className="muted">Заданий пока нет.</p>}
        {cls.assignments.map((a) => {
          const info = lessonById(a.lessonId);
          const doneN = all.filter((st) => st.done[a.id]).length;
          const overdue = a.due < dayKey();
          return (
            <div key={a.id} className="card assign-row">
              <span className="as-unit" style={{ background: info?.unit.color }}>
                {info?.unit.n}
              </span>
              <div className="grow">
                <b>
                  {info?.lesson.title} <span className="muted">· <ShorText text={info?.unit.shorTitle ?? ''} /></span>
                </b>
                <small className={cx(overdue && 'overdue')}>
                  Срок: {fmtDate(a.due)}
                  {overdue && ' · просрочено'}
                </small>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <div className="bar sm green grow">
                    <i style={{ width: `${(doneN / all.length) * 100}%` }} />
                  </div>
                  <small className="muted">
                    {doneN}/{all.length}
                  </small>
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="Удалить задание"
                onClick={() =>
                  setState((d) => {
                    if (d.cls.myClass) d.cls.myClass.assignments = d.cls.myClass.assignments.filter((x) => x.id !== a.id);
                  })
                }
              >
                <Icon name="trash" size={20} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <h2 className="sec-title">Ученики</h2>
        <span className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => copyTable(exportCsv())}>
            <Icon name="copy" size={18} /> Копировать
          </button>
          <button className="btn sm ghost" onClick={saveCsv}>
            <Icon name="download" size={18} /> CSV
          </button>
        </span>
      </div>
      <div className="students card">
        <div className="st-head">
          <span>Ученик</span>
          <span>Опыт</span>
          <span className="hide-sm">Уроки</span>
          <span className="hide-sm">Серия</span>
          <span>Задания</span>
        </div>
        {sorted.map((st) => (
          <div key={st.name} className={cx('st-row', st.me && 'me')}>
            <span className="row" style={{ gap: 10 }}>
              <Avatar name={st.name} idx={st.avatar} size={34} />
              <span className="st-name">
                {st.name}
                <small>{st.last === dayKey() ? 'сегодня' : fmtDate(st.last)}</small>
              </span>
            </span>
            <b>{st.xp}</b>
            <span className="hide-sm">{st.lessons}</span>
            <span className="hide-sm">🔥 {st.streak}</span>
            <span className="st-tasks">
              {cls.assignments.map((a) => (
                <i key={a.id} className={cx(st.done[a.id] && 'on')} title={lessonById(a.lessonId)?.lesson.title} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="muted small-note">Демо-режим: ученики сгенерированы для примера. В пилоте с 10 школами прогресс будет синхронизироваться через сервер.</p>

      <NewTaskModal
        open={newTask}
        onClose={() => setNewTask(false)}
        onCreate={(lessonId, due) =>
          setState((d) => {
            d.cls.myClass?.assignments.push({ id: 'a' + Date.now(), lessonId, due, createdAt: Date.now() });
          })
        }
      />
      <Modal open={showQr} onClose={() => setShowQr(false)}>
        <div className="center col" style={{ alignItems: 'center' }}>
          <h2>Вступить в класс {cls.name}</h2>
          <QR text={joinUrl} size={240} />
          <div className="code-big">{cls.code}</div>
          <p className="muted">Покажите QR-код на проекторе или распечатайте.</p>
        </div>
      </Modal>
    </div>
  );
}

function StudentView() {
  const s = useStore((x) => x);
  const [leave, setLeave] = useState(false);
  const [code, setCode] = useState(() => {
    try {
      return sessionStorage.getItem('tadar.join') ?? '';
    } catch {
      return '';
    }
  });
  const joined = s.cls.joined;

  const join = () => {
    const LAT: Record<string, string> = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', P: 'Р', C: 'С', T: 'Т' };
    const c = code
      .trim()
      .toUpperCase()
      .replace(/[ABEKMHPCT]/g, (ch) => LAT[ch]);
    if (c.length < 4) {
      toast('Введите код из 6 символов', { icon: '⚠️' });
      return;
    }
    try {
      sessionStorage.removeItem('tadar.join');
    } catch {
      /* noop */
    }
    const own = getState().cls.myClass;
    setState((d) => {
      if (own && own.code === c) {
        d.cls.joined = { code: c, name: own.name, teacher: d.profile.name || 'Учитель', joinedAt: Date.now(), assignments: [] };
      } else {
        const cur = currentLessonId(d) ?? 'u1l1';
        const idx = LESSONS.findIndex((l) => l.lesson.id === cur);
        const next = LESSONS[Math.min(LESSONS.length - 1, idx + 1)].lesson.id;
        const assignments: Assignment[] = [
          { id: 'd1', lessonId: cur, due: addDays(dayKey(), 3), createdAt: Date.now() },
          { id: 'd2', lessonId: next, due: addDays(dayKey(), 7), createdAt: Date.now() },
        ];
        d.cls.joined = { code: c, name: `Класс ${c}`, teacher: 'Учитель шорского языка', joinedAt: Date.now(), assignments };
      }
    });
    runAchievementCheck().forEach((id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) toast(`Достижение: ${a.title}`, { icon: a.icon });
    });
    toast('Вы в классе!', { icon: '🎉', sub: 'Задания учителя появятся на карте уроков' });
  };

  if (!joined) {
    return (
      <div className="page classmode">
        <PageHead title="Мой класс" sub="Вступите по коду учителя" icon="school" />
        <div className="card join-card">
          <Mascot pose="point-r" size={120} />
          <div className="grow col">
            <b>Введите код класса</b>
            <input id="class-code" className="input code-input" value={code} maxLength={6} placeholder="Например: К7М2ТП" onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && join()} />
            <button className="btn green" onClick={join}>
              Вступить
            </button>
          </div>
        </div>
        <button className="btn text" onClick={() => setState((d) => void (d.cls.role = 'teacher'))}>
          Я учитель
        </button>
        <ClassPitch />
      </div>
    );
  }

  const own = s.cls.myClass && joined.code === s.cls.myClass.code;
  const tasks = own ? s.cls.myClass!.assignments : joined.assignments;
  const classmates = demoStudents({ name: joined.name, school: '', code: joined.code, createdAt: joined.joinedAt, assignments: tasks });
  const board = [...classmates.map((c) => ({ name: c.name, xp: c.xp, avatar: c.avatar, me: false })), { name: s.profile.name || 'Вы', xp: weekXp(s), avatar: s.profile.avatar, me: true }].sort((a, b) => b.xp - a.xp);

  return (
    <div className="page classmode">
      <PageHead title={joined.name} sub={`Учитель: ${joined.teacher}`} icon="school">
        {s.cls.myClass && (
          <button className="btn sm ghost" onClick={() => setState((d) => void (d.cls.role = 'teacher'))}>
            Как учитель
          </button>
        )}
      </PageHead>
      <h2 className="sec-title">Задания</h2>
      <div className="assign-list">
        {tasks.length === 0 && <p className="muted">Учитель ещё не задал уроков.</p>}
        {tasks.map((a) => {
          const info = lessonById(a.lessonId);
          const done = !!s.lessons[a.lessonId]?.done;
          return (
            <div key={a.id} className={cx('card assign-row', done && 'done')}>
              <span className="as-unit" style={{ background: info?.unit.color }}>
                {done ? <Icon name="check" size={20} /> : info?.unit.n}
              </span>
              <div className="grow">
                <b>{info?.lesson.title}</b>
                <small>
                  <ShorText text={info?.unit.shorTitle ?? ''} /> · срок {fmtDate(a.due)}
                </small>
              </div>
              {done ? (
                <span className="pill green">Готово</span>
              ) : (
                <button className="btn sm" onClick={() => navigate('lesson/' + a.lessonId)}>
                  Начать
                </button>
              )}
            </div>
          );
        })}
      </div>
      <h2 className="sec-title">Рейтинг класса за неделю</h2>
      <ol className="board">
        {board.map((r, i) => (
          <li key={r.name + i} className={cx('board-row', r.me && 'me')}>
            <span className="rank">{i + 1}</span>
            <Avatar name={r.name} idx={r.avatar} size={38} />
            <span className="grow b-name">{r.name}</span>
            <b className="b-xp">{r.xp} опыта</b>
          </li>
        ))}
      </ol>
      {leave ? (
        <div className="row leave-confirm">
          <span className="grow">Выйти из класса? Задания учителя пропадут с карты уроков.</span>
          <button className="btn sm red" onClick={() => setState((d) => void (d.cls.joined = undefined))}>
            Выйти
          </button>
          <button className="btn sm ghost" onClick={() => setLeave(false)}>
            Остаться
          </button>
        </div>
      ) : (
        <button className="btn text" style={{ color: 'var(--red)' }} onClick={() => setLeave(true)}>
          Выйти из класса
        </button>
      )}
    </div>
  );
}
