/* Режим «Класс» с сервером: настоящие ученики, задания и прогресс. */
import { useCallback, useEffect, useState } from 'react';
import { useStore, setState } from '../state/store';
import { lessonById } from '../data/course';
import { runAchievementCheck, ACHIEVEMENTS } from '../state/game';
import { Icon } from '../ui/Icon';
import { Avatar, Mascot, Modal, toast, ShorText } from '../ui/kit';
import { navigate } from '../lib/router';
import { cx, dayKey, fmtDate, plural } from '../lib/util';
import { PageHead } from '../layout/Layout';
import { copyText } from '../lib/platform';
import { net, errorText } from '../net/client';
import { retryNow } from '../net';
import {
  addAssignment,
  classAssignments,
  classBoard,
  classStudents,
  createClass,
  deleteClass,
  joinClass,
  leaveClass,
  refreshStudentClass,
  removeAssignment,
  removeStudent,
  teacherClasses,
  type BoardRow,
  type ServerAssignment,
  type ServerClass,
  type StudentRow,
} from '../net/classes';
import { QR, ClassPitch, NewTaskModal, joinUrl, toCsv, copyTable, saveTable } from './ClassParts';
import { SignupCard } from './Signup';

const SEL_KEY = 'tadar.class.sel';

function celebrate() {
  runAchievementCheck().forEach((id) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) toast(`Достижение: ${a.title}`, { icon: a.icon });
  });
}

const lastSeen = (iso: string) => {
  const k = dayKey(new Date(iso));
  return k === dayKey() ? 'сегодня' : fmtDate(k);
};

/** Пока нет связи: ожидание или кнопка повтора. */
function NetGate({ title }: { title: string }) {
  const n = net.use();
  const offline = n.status === 'offline';
  return (
    <div className="page classmode">
      <PageHead title={title} icon="school" />
      <div className="card net-gate">
        <Mascot pose="head" size={80} />
        <div className="grow">
          <b>{offline ? 'Нет связи с сервером' : 'Подключаемся…'}</b>
          <p className="muted">{offline ? 'Классу нужен интернет: так ученики и учитель видят одно и то же. Проверьте подключение.' : 'Ещё секунда — загружаем данные класса.'}</p>
        </div>
        {offline && (
          <button className="btn sm" onClick={retryNow}>
            Повторить
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Учитель ─────────────────────────────────────────────────────── */

function CreateClass({ first, onCreated, onCancel }: { first: boolean; onCreated: (c: ServerClass) => void; onCancel?: () => void }) {
  const [name, setName] = useState('7 «Б»');
  const [school, setSchool] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const c = await createClass(name, school);
      onCreated(c);
      celebrate();
      toast('Класс создан', { icon: '🏫', sub: `Код для учеников: ${c.code}` });
    } catch (e) {
      toast('Класс не создан', { icon: '⚠️', sub: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card col create-class">
      <label>
        <span className="label">Название класса</span>
        <input id="class-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span className="label">Школа</span>
        <input id="class-school" className="input" value={school} maxLength={80} placeholder="Например: школа № 1, Таштагол" onChange={(e) => setSchool(e.target.value)} />
      </label>
      <button className="btn green lg" disabled={!name.trim() || busy} onClick={create}>
        {busy ? 'Создаём…' : 'Создать класс'}
      </button>
      {first ? (
        <button className="btn text" onClick={() => setState((d) => void (d.cls.role = undefined))}>
          Я не учитель
        </button>
      ) : (
        <button className="btn text" onClick={onCancel}>
          Отмена
        </button>
      )}
    </div>
  );
}

export function TeacherOnline() {
  const n = net.use();
  const [classes, setClasses] = useState<ServerClass[] | null>(null);
  const [sel, setSel] = useState<string | null>(() => localStorage.getItem(SEL_KEY));
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [tasks, setTasks] = useState<ServerAssignment[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [kick, setKick] = useState<string | null>(null);
  const online = n.status === 'online';

  useEffect(() => {
    if (online) teacherClasses().then(setClasses, () => undefined);
  }, [online]);

  const cls = classes?.find((c) => c.id === sel) ?? classes?.[classes.length - 1];
  const classId = cls?.id;

  const loadClass = useCallback(async (id: string) => {
    const [st, t] = await Promise.all([classStudents(id), classAssignments(id)]);
    setStudents(st);
    setTasks(t);
  }, []);

  useEffect(() => {
    if (!classId || !online) return;
    setStudents(null);
    loadClass(classId).catch(() => undefined);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadClass(classId).catch(() => undefined);
    }, 30000);
    return () => clearInterval(t);
  }, [classId, online, loadClass]);

  const choose = (id: string) => {
    setSel(id);
    try {
      localStorage.setItem(SEL_KEY, id);
    } catch {
      /* noop */
    }
  };

  if (!classes) return <NetGate title="Режим учителя" />;

  if (!cls || creating) {
    return (
      <div className="page classmode">
        <PageHead title="Новый класс" sub="Учитель шорского языка" icon="school" />
        <CreateClass
          first={!cls}
          onCancel={() => setCreating(false)}
          onCreated={(c) => {
            setClasses([...(classes ?? []), c]);
            choose(c.id);
            setCreating(false);
          }}
        />
        {!cls && <ClassPitch online />}
      </div>
    );
  }

  const list = students ?? [];
  const totalXp = list.reduce((a, b) => a + b.week_xp, 0);
  const accs = list.map((x) => x.accuracy).filter((x): x is number => typeof x === 'number');
  const avgAcc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;
  const url = joinUrl(cls.code);
  const title = (lessonId: string) => lessonById(lessonId)?.lesson.title ?? lessonId;

  const exportCsv = () => {
    const head = ['Ученик', 'Опыт за неделю', 'Опыт всего', 'Уроков', 'Серия', 'Точность %', 'Был(а)', ...tasks.map((a) => title(a.lesson_id))];
    const lines = list.map((st) => [
      st.name || 'Без имени',
      st.week_xp,
      st.xp_total,
      st.lessons_done,
      st.streak,
      st.accuracy ?? '',
      dayKey(new Date(st.last_active)),
      ...tasks.map((a) => (st.done.includes(a.lesson_id) ? 'да' : 'нет')),
    ]);
    return toCsv([head, ...lines]);
  };

  return (
    <div className="page classmode wide-page">
      <PageHead title={`Класс ${cls.name}`} sub={cls.school || 'Режим учителя'} icon="school">
        <button className="btn sm ghost" onClick={() => setState((d) => void (d.cls.role = 'student'))}>
          Как ученик
        </button>
      </PageHead>

      <div className="chips class-switch">
        {classes.map((c) => (
          <button key={c.id} className={cx('chip', c.id === cls.id && 'on')} onClick={() => choose(c.id)}>
            {c.name}
          </button>
        ))}
        <button className="chip" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> Новый класс
        </button>
      </div>

      <section className="class-code card">
        <div className="grow">
          <span className="eyebrow">Код для учеников</span>
          <div className="code-big">{cls.code}</div>
          <p className="muted">Ученики вводят код в разделе «Класс» → «Я ученик» или сканируют QR-код камерой телефона.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn sm"
              onClick={async () => {
                const ok = await copyText(cls.code);
                toast(ok ? 'Код скопирован' : cls.code, { icon: '📋' });
              }}
            >
              <Icon name="copy" size={18} /> Копировать
            </button>
            <button className="btn sm ghost" onClick={() => setShowQr(true)}>
              <Icon name="qr" size={18} /> QR-код
            </button>
            <button
              className="btn sm ghost"
              onClick={async () => {
                const ok = await copyText(url);
                toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать', { icon: '🔗', sub: ok ? 'Отправьте её в чат класса' : undefined });
              }}
            >
              <Icon name="copy" size={18} /> Ссылка
            </button>
          </div>
        </div>
        <QR text={url} size={140} />
      </section>

      <div className="class-stats">
        <div className="stat-tile">
          <Icon name="users" size={30} style={{ color: 'var(--blue)' }} />
          <div>
            <b>{list.length}</b>
            <small>{plural(list.length, ['ученик', 'ученика', 'учеников'])}</small>
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
            <b>{avgAcc === null ? '—' : `${avgAcc}%`}</b>
            <small>средняя точность</small>
          </div>
        </div>
        <div className="stat-tile">
          <Icon name="book" size={30} />
          <div>
            <b>{tasks.length}</b>
            <small>{plural(tasks.length, ['задание', 'задания', 'заданий'])}</small>
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
        {tasks.length === 0 && <p className="muted">Заданий пока нет. Задайте урок — он появится у учеников на карте уроков.</p>}
        {tasks.map((a) => {
          const info = lessonById(a.lesson_id);
          const doneN = list.filter((st) => st.done.includes(a.lesson_id)).length;
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
                    <i style={{ width: `${list.length ? (doneN / list.length) * 100 : 0}%` }} />
                  </div>
                  <small className="muted">
                    {doneN}/{list.length}
                  </small>
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="Удалить задание"
                onClick={async () => {
                  try {
                    await removeAssignment(a.id);
                    setTasks((t) => t.filter((x) => x.id !== a.id));
                  } catch (e) {
                    toast('Не удалось удалить', { icon: '⚠️', sub: errorText(e) });
                  }
                }}
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
          <button className="icon-btn" aria-label="Обновить" title="Обновить" onClick={() => loadClass(cls.id).catch(() => undefined)}>
            <Icon name="refresh" size={20} />
          </button>
          <button className="btn sm ghost" disabled={!list.length} onClick={() => copyTable(exportCsv())}>
            <Icon name="copy" size={18} /> Копировать
          </button>
          <button className="btn sm ghost" disabled={!list.length} onClick={() => saveTable(cls.name, exportCsv())}>
            <Icon name="download" size={18} /> CSV
          </button>
        </span>
      </div>
      {students === null ? (
        <div className="students card">
          <p className="muted center" style={{ padding: 18 }}>
            Загружаем учеников…
          </p>
        </div>
      ) : list.length === 0 ? (
        <div className="card flat empty-students">
          <Icon name="users" size={34} />
          <p>Пока никто не вступил. Покажите ученикам код или QR-код — они появятся здесь сразу после вступления.</p>
        </div>
      ) : (
        <div className="students card">
          <div className="st-head">
            <span>Ученик</span>
            <span>Опыт</span>
            <span className="hide-sm">Уроки</span>
            <span className="hide-sm">Серия</span>
            <span>Задания</span>
          </div>
          {list.map((st) => (
            <div key={st.user_id} className="st-row">
              <span className="row" style={{ gap: 10, minWidth: 0 }}>
                <Avatar name={st.name || 'У'} idx={st.avatar} size={34} />
                <span className="st-name">
                  {st.name || 'Без имени'}
                  <small>
                    {lastSeen(st.last_active)}
                    {st.accuracy !== null && ` · ${st.accuracy}%`}
                  </small>
                </span>
              </span>
              <b title="Опыт за неделю">{st.week_xp}</b>
              <span className="hide-sm">{st.lessons_done}</span>
              <span className="hide-sm">🔥 {st.streak}</span>
              <span className="st-tasks">
                {tasks.map((a) => (
                  <i key={a.id} className={cx(st.done.includes(a.lesson_id) && 'on')} title={title(a.lesson_id)} />
                ))}
                {kick === st.user_id ? (
                  <span className="kick">
                    <button
                      className="btn sm red"
                      onClick={async () => {
                        try {
                          await removeStudent(cls.id, st.user_id);
                          setStudents((x) => (x ?? []).filter((y) => y.user_id !== st.user_id));
                        } catch (e) {
                          toast('Не получилось', { icon: '⚠️', sub: errorText(e) });
                        }
                        setKick(null);
                      }}
                    >
                      Исключить
                    </button>
                    <button className="btn sm ghost" onClick={() => setKick(null)}>
                      Нет
                    </button>
                  </span>
                ) : (
                  <button className="icon-btn kick-btn" aria-label="Исключить из класса" title="Исключить из класса" onClick={() => setKick(st.user_id)}>
                    <Icon name="close" size={16} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="muted small-note">Опыт — за текущую неделю. Таблица обновляется каждые 30 секунд.</p>

      {askDelete ? (
        <div className="row leave-confirm">
          <span className="grow">Удалить класс «{cls.name}»? Ученики выйдут из него, задания пропадут.</span>
          <button
            className="btn sm red"
            onClick={async () => {
              try {
                await deleteClass(cls.id);
                const rest = classes.filter((c) => c.id !== cls.id);
                setClasses(rest);
                setState((d) => void (d.cls.teaching = rest.length));
                setAskDelete(false);
                toast('Класс удалён', { icon: '🗑️' });
              } catch (e) {
                toast('Не удалось удалить класс', { icon: '⚠️', sub: errorText(e) });
              }
            }}
          >
            Удалить
          </button>
          <button className="btn sm ghost" onClick={() => setAskDelete(false)}>
            Отмена
          </button>
        </div>
      ) : (
        <button className="btn text" style={{ color: 'var(--red)' }} onClick={() => setAskDelete(true)}>
          Удалить класс
        </button>
      )}

      <NewTaskModal
        open={newTask}
        onClose={() => setNewTask(false)}
        onCreate={async (lessonId, due) => {
          await addAssignment(cls.id, lessonId, due);
          setTasks(await classAssignments(cls.id));
        }}
      />
      <Modal open={showQr} onClose={() => setShowQr(false)}>
        <div className="center col" style={{ alignItems: 'center' }}>
          <h2>Вступить в класс {cls.name}</h2>
          <QR text={url} size={240} />
          <div className="code-big">{cls.code}</div>
          <p className="muted">Покажите QR-код на проекторе или распечатайте.</p>
        </div>
      </Modal>
    </div>
  );
}

/* ── Ученик ──────────────────────────────────────────────────────── */

function pendingCode() {
  try {
    return sessionStorage.getItem('tadar.join') ?? '';
  } catch {
    return '';
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem('tadar.join');
  } catch {
    /* noop */
  }
}

export function StudentOnline() {
  const s = useStore((x) => x);
  const n = net.use();
  const online = n.status === 'online';
  const joined = s.cls.joined?.id ? s.cls.joined : undefined;
  const [code, setCode] = useState(pendingCode);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [leave, setLeave] = useState(false);

  useEffect(() => {
    if (!online) return;
    refreshStudentClass()
      .catch(() => undefined)
      .finally(() => setChecked(true));
  }, [online]);

  const join = useCallback(
    async (raw: string) => {
      if (raw.trim().length < 6) {
        toast('Введите код из 6 символов', { icon: '⚠️' });
        return;
      }
      setBusy(true);
      try {
        const cls = await joinClass(raw);
        clearPending();
        if (!cls) {
          toast('Класс не найден', { icon: '🔎', sub: 'Проверьте код у учителя' });
          return;
        }
        celebrate();
        toast('Вы в классе!', { icon: '🎉', sub: 'Задания учителя появятся на карте уроков' });
      } catch (e) {
        toast('Не удалось вступить', { icon: '⚠️', sub: errorText(e) });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // пришли по QR-коду — вступаем сразу
  useEffect(() => {
    const p = pendingCode();
    if (online && checked && p && !busy) {
      if (joined) clearPending();
      else void join(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, checked]);

  const classId = joined?.id;
  useEffect(() => {
    if (!classId || !online) return;
    const load = () => classBoard(classId).then(setBoard, () => undefined);
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 60000);
    return () => clearInterval(t);
  }, [classId, online]);

  if (!joined && (!online || !checked)) return <NetGate title="Мой класс" />;

  if (!joined) {
    return (
      <div className="page classmode">
        <PageHead title="Мой класс" sub="Вступите по коду учителя" icon="school" />
        <div className="card join-card">
          <Mascot pose="point-r" size={120} />
          <div className="grow col">
            <b>Введите код класса</b>
            <input
              id="class-code"
              className="input code-input"
              value={code}
              maxLength={6}
              placeholder="Например: К7М2ТП"
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && join(code)}
            />
            <button className="btn green" disabled={busy} onClick={() => join(code)}>
              {busy ? 'Проверяем…' : 'Вступить'}
            </button>
          </div>
        </div>
        <button className="btn text" onClick={() => setState((d) => void (d.cls.role = 'teacher'))}>
          Я учитель
        </button>
        <ClassPitch online />
      </div>
    );
  }

  const tasks = joined.assignments;
  return (
    <div className="page classmode">
      <PageHead title={joined.name} sub={`Учитель: ${joined.teacher}`} icon="school">
        {(s.cls.teaching ?? 0) > 0 && (
          <button className="btn sm ghost" onClick={() => setState((d) => void (d.cls.role = 'teacher'))}>
            Как учитель
          </button>
        )}
      </PageHead>
      {n.status === 'offline' && <p className="muted net-note">Нет связи — показаны последние задания.</p>}
      <SignupCard place="class" title="Не потеряйте результаты" text="Создайте аккаунт — учитель будет видеть ваши успехи, даже если вы смените телефон или браузер." />
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
      {board === null ? (
        <p className="muted">Загружаем одноклассников…</p>
      ) : (
        <ol className="board">
          {board.map((r, i) => {
            const me = r.user_id === n.uid;
            return (
              <li key={r.user_id} className={cx('board-row', me && 'me')}>
                <span className="rank">{i + 1}</span>
                <Avatar name={(me ? s.profile.name : r.name) || 'У'} idx={me ? s.profile.avatar : r.avatar} size={38} />
                <span className="grow b-name">
                  {(me ? s.profile.name : r.name) || 'Без имени'}
                  {me && <small> (вы)</small>}
                </span>
                <b className="b-xp">{r.week_xp} опыта</b>
              </li>
            );
          })}
        </ol>
      )}
      {leave ? (
        <div className="row leave-confirm">
          <span className="grow">Выйти из класса? Задания учителя пропадут с карты уроков.</span>
          <button
            className="btn sm red"
            onClick={async () => {
              try {
                await leaveClass(joined.id!);
                setLeave(false);
              } catch (e) {
                toast('Не получилось выйти', { icon: '⚠️', sub: errorText(e) });
              }
            }}
          >
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
