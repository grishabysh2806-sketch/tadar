import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lessonById, UNITS } from '../data/course';
import { ruShow } from '../data/vocab';
import { epicById } from '../data/epics';
import { generateLesson, generatePractice, exerciseItems, accepted, KIND_TITLE, type Exercise } from '../lesson/generate';
import { IntroCard, ChooseRu, ChooseShor, PictureChoice, ListenChoice, MatchPairs, BuildSentence, TypeAnswer, ListenType, FillBlank, type Status } from '../lesson/exercises';
import { getState, useStore, heartsNow, MAX_HEARTS, setState, streakNow } from '../state/store';
import { completeLesson, loseHeart, recordAnswer, weakItems, claimEpic, isLessonUnlocked, practiceAvailable, type LessonSummary } from '../state/game';
import { checkRu, checkShor, normalize, tokens } from '../lib/text';
import { Icon } from '../ui/Icon';
import { Mascot, Modal, ShorText, Confetti, CountUp, toast } from '../ui/kit';
import { navigate } from '../lib/router';
import { sfx, vibrate } from '../audio/engine';
import { canSpeak, stopSpeech } from '../audio/voice';
import { cx, fmtDuration, plural, pick } from '../lib/util';
import { WeekFlames } from '../layout/Layout';
import { ACHIEVEMENTS, questDef } from '../state/game';
import { Benefits, hideSignup, isGuestNow, openSignup, signupHidden, useGuest } from './Signup';

type Answer = string | number[] | undefined;

interface Verdict {
  ok: boolean;
  title: string;
  correct?: React.ReactNode;
  note?: string;
}

const PRAISE = ['Отлично!', 'Верно!', 'Так держать!', 'Чақшы! Хорошо!', 'Великолепно!', 'Точно в цель!', 'Молодец!'];

function evaluate(ex: Exercise, a: Answer): Verdict {
  const praise = pick(PRAISE);
  switch (ex.kind) {
    case 'choose_ru':
      return a === ex.item.id ? { ok: true, title: praise } : { ok: false, title: 'Правильный ответ:', correct: ruShow(ex.item), note: ex.item.note };
    case 'choose_shor':
    case 'picture':
    case 'listen':
      return a === ex.item.id
        ? { ok: true, title: praise, note: ex.kind === 'picture' ? undefined : undefined }
        : { ok: false, title: 'Правильный ответ:', correct: <><ShorText text={ex.item.shor} /> — {ruShow(ex.item)}</>, note: ex.item.note };
    case 'fill':
      return a === ex.answer ? { ok: true, title: praise } : { ok: false, title: 'Правильный ответ:', correct: <ShorText text={ex.sentence.shor} /> };
    case 'build': {
      const chosen = (a as number[] | undefined)?.map((i) => ex.tiles[i]) ?? [];
      const variants = ex.dir === 'shor2ru' ? [ex.sentence.ru, ...(ex.sentence.ruAlt ?? [])] : [ex.sentence.shor];
      const ok = variants.some((v) => normalize(tokens(v).join(' ')) === normalize(chosen.join(' ')));
      return ok
        ? { ok: true, title: praise, correct: ex.dir === 'shor2ru' ? undefined : undefined }
        : { ok: false, title: 'Правильный ответ:', correct: ex.dir === 'shor2ru' ? ex.sentence.ru : <ShorText text={ex.sentence.shor} />, note: ex.sentence.note };
    }
    case 'type': {
      const input = (a as string) ?? '';
      if (ex.dir === 'ru2shor') {
        const r = checkShor(input, [ex.item.shor.replace(/-$/, '')]);
        if (!r.ok) return { ok: false, title: 'Правильный ответ:', correct: <ShorText text={ex.item.shor} />, note: ex.item.note };
        if (r.letters) return { ok: true, title: 'Почти! Не забывайте особые буквы:', correct: <ShorText text={ex.item.shor} /> };
        if (r.typo) return { ok: true, title: 'Верно, но есть опечатка:', correct: <ShorText text={ex.item.shor} /> };
        return { ok: true, title: praise };
      }
      const r = checkRu(input, accepted(ex.item));
      if (!r.ok) return { ok: false, title: 'Правильный ответ:', correct: ruShow(ex.item), note: ex.item.note };
      if (r.typo) return { ok: true, title: 'Верно, но есть опечатка:', correct: r.best };
      return { ok: true, title: praise, correct: ex.item.ru.includes(';') ? `Также: ${ruShow(ex.item)}` : undefined };
    }
    case 'listen_type': {
      const r = checkShor((a as string) ?? '', [ex.item.shor.replace(/-$/, '')]);
      if (!r.ok) return { ok: false, title: 'Правильный ответ:', correct: <><ShorText text={ex.item.shor} /> — {ruShow(ex.item)}</> };
      if (r.letters) return { ok: true, title: 'Почти! Не забывайте особые буквы:', correct: <ShorText text={ex.item.shor} /> };
      if (r.typo) return { ok: true, title: 'Верно, но есть опечатка:', correct: <ShorText text={ex.item.shor} /> };
      return { ok: true, title: praise, correct: <>«{ruShow(ex.item)}»</> };
    }
    default:
      return { ok: true, title: praise };
  }
}

function canCheck(ex: Exercise, a: Answer) {
  if (ex.kind === 'intro' || ex.kind === 'match') return true;
  if (ex.kind === 'build') return Array.isArray(a) && a.length > 0;
  if (ex.kind === 'type' || ex.kind === 'listen_type') return typeof a === 'string' && a.trim().length > 0;
  return !!a;
}

export default function LessonPage({ practice }: { practice?: boolean }) {
  const lessonId = practice ? undefined : window.location.hash.split('/')[2];
  const info = lessonId ? lessonById(lessonId) : undefined;
  const settings = useStore((s) => s.settings);
  const [audioOk, setAudioOk] = useState(() => canSpeak());

  // Проверка доступа
  const allowed = useMemo(() => {
    const s = getState();
    if (practice) return practiceAvailable(s);
    if (!info) return false;
    const assigned = [...(s.cls.myClass?.assignments ?? []), ...(s.cls.joined?.assignments ?? [])].some((a) => a.lessonId === lessonId);
    const travelUnit = info.unit.id === 'u11' && (info.index === 0 || !!s.lessons[info.unit.lessons[info.index - 1].id]?.done);
    return isLessonUnlocked(s, info.lesson.id) || assigned || travelUnit;
  }, [practice, info, lessonId]);

  const initial = useMemo<Exercise[]>(() => {
    const s = getState();
    if (practice) return generatePractice(weakItems(s, 8), s, { audio: audioOk });
    if (!info) return [];
    return generateLesson(info.lesson, s, { audio: audioOk, replay: !!s.lessons[info.lesson.id]?.done });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, lessonId]);

  const [queue, setQueue] = useState<Exercise[]>(initial);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<Answer>(undefined);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [done, setDone] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0, mistakes: 0, bestCombo: 0 });
  const [quit, setQuit] = useState(false);
  const [noHearts, setNoHearts] = useState(false);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [comboFlash, setComboFlash] = useState(0);
  const startRef = useRef(Date.now());
  const footRef = useRef<HTMLDivElement>(null);
  const s = useStore((x) => x);
  const hearts = heartsNow(s);
  const ex = queue[idx];
  const total = initial.length;

  useEffect(() => () => stopSpeech(), []);

  const finish = useCallback(
    (st = stats) => {
      const res = completeLesson({
        kind: practice ? 'practice' : 'lesson',
        lessonId: info?.lesson.id,
        correct: st.correct,
        total: st.total,
        mistakes: st.mistakes,
        bestCombo: st.bestCombo,
        ms: Date.now() - startRef.current,
      });
      sfx('complete');
      setSummary(res);
    },
    [stats, practice, info],
  );

  const next = useCallback(() => {
    setVerdict(null);
    setAnswer(undefined);
    if (getState().settings.hearts && !practice && heartsNow(getState()) <= 0) {
      setNoHearts(true);
      return;
    }
    if (idx + 1 >= queue.length) finish();
    else setIdx(idx + 1);
  }, [idx, queue.length, finish, practice]);

  const grade = useCallback(
    (ok: boolean, exNow: Exercise) => {
      const items = exerciseItems(exNow);
      if (items.length) recordAnswer(items, ok);
      setStats((st) => {
        const c = ok ? combo + 1 : 0;
        return {
          correct: st.correct + (ok ? 1 : 0),
          total: st.total + 1,
          mistakes: st.mistakes + (ok ? 0 : 1),
          bestCombo: Math.max(st.bestCombo, c),
        };
      });
      if (ok) {
        const c = combo + 1;
        setCombo(c);
        if (c >= 3 && (c === 3 || c % 5 === 0)) setComboFlash(c);
        setDone((d) => d + 1);
        sfx('correct');
      } else {
        setCombo(0);
        sfx('wrong');
        vibrate(120);
        if (!practice) loseHeart();
        if (!exNow.key.endsWith('r')) {
          setQueue((q) => [...q, { ...exNow, key: exNow.key + 'r' } as Exercise]);
        } else {
          // второй промах — считаем пройденным, чтобы урок не стал бесконечным
          setDone((d) => d + 1);
        }
      }
    },
    [combo, practice],
  );

  const check = useCallback(() => {
    if (!ex || verdict) return;
    if (ex.kind === 'intro') {
      setDone((d) => d + 1);
      sfx('tap');
      next();
      return;
    }
    if (!canCheck(ex, answer)) return;
    const v = evaluate(ex, answer);
    setVerdict(v);
    grade(v.ok, ex);
    setTimeout(() => footRef.current?.querySelector<HTMLButtonElement>('.btn')?.focus(), 50);
  }, [ex, verdict, answer, grade, next]);

  const skip = () => {
    if (!ex || verdict) return;
    const v = evaluate(ex, '__skip__');
    setVerdict({ ...v, ok: false, title: 'Правильный ответ:' });
    grade(false, ex);
  };

  const cantListen = () => {
    setAudioOk(false);
    // заменяем аудио-задания на обычные
    setQueue((q) =>
      q.map((e, i) => {
        if (i < idx) return e;
        if (e.kind === 'listen') return { kind: 'choose_shor', key: e.key, item: e.item, options: e.options } as Exercise;
        if (e.kind === 'listen_type') return { kind: 'type', key: e.key, item: e.item, dir: 'ru2shor' } as Exercise;
        return e;
      }),
    );
    toast('Задания на слух отключены до конца урока', { icon: '🔇' });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || summary || quit || noHearts) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA') return;
      if (tag === 'BUTTON' && !(e.target as HTMLElement).closest('.lesson-foot')) return;
      e.preventDefault();
      if (verdict) next();
      else check();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [verdict, next, check, summary, quit, noHearts]);

  // Отладка в dev-режиме: window.__lesson.solve() отвечает верно на текущее задание
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__lesson = {
      ex,
      idx,
      total: queue.length,
      solve: () => {
        if (!ex) return;
        if (ex.kind === 'build') {
          const used = new Set<number>();
          setAnswer(
            ex.answer.map((t) => {
              const i = ex.tiles.findIndex((x, j) => x === t && !used.has(j));
              used.add(i);
              return i;
            }),
          );
        }
        else if (ex.kind === 'type') setAnswer(ex.dir === 'ru2shor' ? ex.item.shor.replace(/-$/, '') : ex.item.ru.split(';')[0]);
        else if (ex.kind === 'listen_type') setAnswer(ex.item.shor.replace(/-$/, ''));
        else if (ex.kind === 'fill') setAnswer(ex.answer);
        else if (ex.kind !== 'intro' && ex.kind !== 'match') setAnswer(ex.item.id);
      },
      wrong: () => {
        if (!ex) return;
        if (ex.kind === 'type' || ex.kind === 'listen_type') setAnswer('ошибка');
        else if (ex.kind === 'build') setAnswer([0]);
        else if (ex.kind === 'fill') setAnswer(ex.options.find((o) => o !== ex.answer));
        else if ('options' in ex) setAnswer((ex.options as { id: string }[]).find((o) => o.id !== (ex as { item: { id: string } }).item.id)?.id);
      },
    };
  }, [ex, idx, queue.length]);

  useEffect(() => {
    if (!comboFlash) return;
    const t = setTimeout(() => setComboFlash(0), 1600);
    return () => clearTimeout(t);
  }, [comboFlash]);

  if (!allowed || !initial.length) {
    return (
      <div className="lesson-blocked">
        <Mascot pose="point" size={170} anim="sad" />
        <h2>{practice ? 'Пока нечего повторять' : 'Этот урок ещё закрыт'}</h2>
        <p className="muted">{practice ? 'Пройдите пару уроков — и здесь появятся слова для тренировки.' : 'Пройдите предыдущие уроки на карте, чтобы открыть его.'}</p>
        <button className="btn" onClick={() => navigate('learn')}>
          К урокам
        </button>
      </div>
    );
  }

  if (summary) return <LessonComplete summary={summary} practice={practice} unitId={info?.unit.id} />;

  const progress = Math.min(1, done / total);
  const isAudio = ex.kind === 'listen' || ex.kind === 'listen_type';

  return (
    <div className="lesson">
      <header className="lesson-top">
        <button className="icon-btn" onClick={() => setQuit(true)} aria-label="Выйти из урока">
          <Icon name="close" size={26} />
        </button>
        <div className="lesson-progress">
          <div className="bar">
            <i style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
          {comboFlash > 0 && (
            <span className="combo-flash" key={comboFlash}>
              <Icon name="flame" size={18} /> {comboFlash} подряд!
            </span>
          )}
        </div>
        {practice ? (
          <span className="lesson-hearts practice" title="В тренировке сердца не тратятся">
            <Icon name="dumbbell" size={24} />
          </span>
        ) : (
          <span className={cx('lesson-hearts', verdict && !verdict.ok && 'lost')}>
            <Icon name={hearts > 0 ? 'heart' : 'heart-off'} size={28} />
            <b>{settings.hearts ? hearts : '∞'}</b>
          </span>
        )}
      </header>

      <main className="lesson-body" key={ex.key}>
        {ex.kind !== 'intro' && (
          <h2 className="ex-title">
            {ex.key.endsWith('r') && <span className="redo">Работа над ошибками</span>}
            {KIND_TITLE[ex.kind]}
          </h2>
        )}
        {ex.kind === 'intro' && <IntroCard ex={ex} />}
        {ex.kind === 'choose_ru' && <ChooseRu ex={ex} value={answer as string} onChange={setAnswer} status={verdict ? (verdict.ok ? 'correct' : 'wrong') : 'idle'} locked={!!verdict} />}
        {ex.kind === 'choose_shor' && <ChooseShor ex={ex} value={answer as string} onChange={setAnswer} status={st(verdict)} locked={!!verdict} />}
        {ex.kind === 'picture' && <PictureChoice ex={ex} value={answer as string} onChange={setAnswer} status={st(verdict)} locked={!!verdict} />}
        {ex.kind === 'listen' && <ListenChoice ex={ex} value={answer as string} onChange={setAnswer} status={st(verdict)} locked={!!verdict} />}
        {ex.kind === 'match' && (
          <MatchPairs
            ex={ex}
            onMistake={() => setStats((x) => ({ ...x, mistakes: x.mistakes + 1 }))}
            onDone={() => {
              recordAnswer(ex.pairs.map((p) => p.id), true);
              setStats((x) => ({ ...x, correct: x.correct + 1, total: x.total + 1 }));
              setDone((d) => d + 1);
              sfx('correct');
              setVerdict({ ok: true, title: pick(PRAISE) });
            }}
          />
        )}
        {ex.kind === 'build' && <BuildSentence ex={ex} value={answer as number[]} onChange={setAnswer} status={st(verdict)} locked={!!verdict} />}
        {ex.kind === 'type' && <TypeAnswer ex={ex} value={answer as string} onChange={setAnswer} status={st(verdict)} locked={!!verdict} onEnter={() => (verdict ? next() : check())} />}
        {ex.kind === 'listen_type' && <ListenType ex={ex} value={answer as string} onChange={setAnswer} status={st(verdict)} locked={!!verdict} onEnter={() => (verdict ? next() : check())} />}
        {ex.kind === 'fill' && <FillBlank ex={ex} value={answer as string} onChange={setAnswer} status={st(verdict)} locked={!!verdict} />}
      </main>

      <footer className={cx('lesson-foot', verdict && (verdict.ok ? 'ok' : 'bad'))} ref={footRef}>
        <div className="lf-inner">
          {verdict ? (
            <>
              <div className="verdict">
                <span className="v-icon">
                  <Icon name={verdict.ok ? 'check' : 'close'} size={30} />
                </span>
                <div>
                  <h3>{verdict.title}</h3>
                  {verdict.correct && <p className="v-correct">{verdict.correct}</p>}
                  {verdict.note && <p className="v-note">{verdict.note}</p>}
                </div>
              </div>
              <button className={cx('btn lg', verdict.ok ? 'green' : 'red')} onClick={next} autoFocus>
                {verdict.ok ? 'Продолжить' : 'Понятно'}
              </button>
            </>
          ) : (
            <>
              {ex.kind === 'intro' || ex.kind === 'match' ? (
                <span />
              ) : isAudio ? (
                <button className="btn ghost lf-skip" onClick={cantListen}>
                  Не могу слушать
                </button>
              ) : (
                <button className="btn ghost lf-skip" onClick={skip}>
                  Пропустить
                </button>
              )}
              {ex.kind !== 'match' && (
                <button className={cx('btn lg green', !canCheck(ex, answer) && 'disabled')} onClick={check} disabled={!canCheck(ex, answer)}>
                  {ex.kind === 'intro' ? 'Продолжить' : 'Проверить'}
                </button>
              )}
            </>
          )}
        </div>
      </footer>

      <Modal open={quit} onClose={() => setQuit(false)}>
        <div className="center col" style={{ alignItems: 'center' }}>
          <Mascot pose="point" size={140} anim="sad" />
          <h2>Подождите, не уходите!</h2>
          <p className="muted">Если выйти сейчас, прогресс этого урока пропадёт.</p>
          <button className="btn block" onClick={() => setQuit(false)}>
            Продолжить урок
          </button>
          <button
            className="btn text block"
            style={{ color: 'var(--red)' }}
            onClick={() => {
              stopSpeech();
              navigate('learn');
            }}
          >
            Выйти
          </button>
        </div>
      </Modal>

      <Modal open={noHearts} dismissable={false}>
        <div className="center col" style={{ alignItems: 'center' }}>
          <Icon name="heart-off" size={90} />
          <h2>Сердца закончились</h2>
          <p className="muted">Новое сердце появится через полчаса. А можно восстановить их прямо сейчас.</p>
          <button
            className={cx('btn block', s.nuts < 350 && 'disabled')}
            disabled={s.nuts < 350}
            onClick={() => {
              setState((d) => {
                d.nuts -= 350;
                d.hearts = MAX_HEARTS;
                d.heartsAt = Date.now();
              });
              setNoHearts(false);
              if (idx + 1 >= queue.length) finish();
              else setIdx(idx + 1);
            }}
          >
            Восстановить · 350 <Icon name="nut" size={20} />
          </button>
          <button className="btn green block" onClick={() => (window.location.hash = '#/practice')}>
            Тренировка: +1 сердце
          </button>
          <button className="btn text block" onClick={() => navigate('learn')}>
            Выйти
          </button>
        </div>
      </Modal>
    </div>
  );
}

const st = (v: Verdict | null): Status => (v ? (v.ok ? 'correct' : 'wrong') : 'idle');

/* ── Итоги урока ────────────────────────────────────────────── */

function LessonComplete({ summary, practice, unitId }: { summary: LessonSummary; practice?: boolean; unitId?: string }) {
  const steps = useMemo(() => {
    const st: string[] = ['result'];
    if (summary.streakExtended) st.push('streak');
    if (summary.unitCompleted) st.push('unit');
    if (isGuestNow() && !signupHidden('lesson')) st.push('signup');
    return st;
  }, [summary]);
  const [step, setStep] = useState(0);
  const cur = steps[step];
  const guest = useGuest();

  useEffect(() => {
    if (cur === 'streak') sfx('streak');
    if (cur === 'unit') sfx('unlock');
  }, [cur]);

  const exit = () => {
    summary.achievements.forEach((a, i) => {
      const def = ACHIEVEMENTS.find((x) => x.id === a);
      if (def) setTimeout(() => toast(`Достижение: ${def.title}`, { icon: def.icon, sub: def.desc }), 400 + i * 700);
    });
    summary.quests.forEach((q, i) => setTimeout(() => toast('Задание выполнено!', { icon: '🎁', sub: questDef(q).title + ' — заберите награду' }), 600 + (summary.achievements.length + i) * 700));
    const s = getState();
    navigate(s.settings.mode === 'traveler' && unitId === 'u11' ? 'travel' : 'learn');
  };
  const nextStep = () => (step + 1 < steps.length ? setStep(step + 1) : exit());

  // аккаунт создан (в том числе ссылкой из письма в другой вкладке) — идём дальше
  useEffect(() => {
    if (cur === 'signup' && !guest) nextStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, guest]);

  if (cur === 'signup') {
    const st = getState();
    const days = streakNow(st);
    return (
      <div className="lesson-done signup-screen">
        <Mascot pose="hero" size={170} anim="bob" />
        <h1>Сохраните прогресс!</h1>
        <p className="muted">
          У вас уже {st.xp} {plural(st.xp, ['очко', 'очка', 'очков'])} опыта{days > 1 ? ` и ${days} ${plural(days, ['день', 'дня', 'дней'])} подряд` : ''}. Создайте аккаунт — соревнуйтесь с друзьями в лиге, а прогресс
          останется с вами на любом устройстве.
        </p>
        <div className="card" style={{ width: '100%', maxWidth: 440 }}>
          <Benefits />
        </div>
        <button className="btn lg block green done-btn" onClick={() => openSignup()}>
          Создать аккаунт
        </button>
        <button
          className="btn text"
          onClick={() => {
            hideSignup('lesson');
            nextStep();
          }}
        >
          Позже
        </button>
      </div>
    );
  }

  if (cur === 'streak') {
    return (
      <div className="lesson-done streak-screen">
        <div className="streak-flame">
          <Icon name="flame" size={150} />
          <span className="streak-num">
            <CountUp from={summary.streakBefore} to={summary.streakAfter} ms={1100} />
          </span>
        </div>
        <h1>
          {summary.streakAfter} {plural(summary.streakAfter, ['день', 'дня', 'дней'])} подряд!
        </h1>
        <p className="muted">{summary.streakAfter === 1 ? 'Огонь разожжён! Возвращайтесь завтра, чтобы он не погас.' : 'Огонь кайчи горит. Не дайте ему погаснуть — до завтра!'}</p>
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <WeekFlames />
        </div>
        <button className="btn lg block done-btn" onClick={nextStep}>
          Продолжить
        </button>
      </div>
    );
  }

  if (cur === 'unit') {
    const u = UNITS.find((x) => x.id === summary.unitCompleted)!;
    const e = epicById(u.epicId)!;
    return (
      <div className="lesson-done">
        <Confetti />
        <Mascot pose="hero" size={200} anim="jump" />
        <h1>Раздел пройден!</h1>
        <p className="muted">
          «<ShorText text={u.shorTitle} /> · {u.title}» — все уроки позади.
        </p>
        <span className="pill gold xp-pill">+50 опыта</span>
        <div className="reward-epic" style={{ maxWidth: 420 }}>
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
          className="btn lg block done-btn"
          onClick={() => {
            claimEpic(u.id);
            navigate('epic/' + e.id);
          }}
        >
          Слушать
        </button>
        <button
          className="btn text"
          onClick={() => {
            claimEpic(u.id);
            exit();
          }}
        >
          Позже
        </button>
      </div>
    );
  }

  const acc = Math.round(summary.accuracy * 100);
  return (
    <div className="lesson-done">
      <Confetti />
      <Mascot pose={acc >= 90 ? 'hero' : 'point'} size={190} anim="jump" />
      <h1 className="done-title">{practice ? 'Тренировка завершена!' : acc === 100 ? 'Безупречно!' : 'Урок пройден!'}</h1>
      <div className="done-tiles">
        <div className="tile-stat gold">
          <span>Опыт</span>
          <b>
            <Icon name="bolt" size={24} /> <CountUp to={summary.xp} />
            {summary.boosted && <small> ×2</small>}
          </b>
        </div>
        <div className="tile-stat green">
          <span>{acc >= 90 ? 'Отлично' : 'Точность'}</span>
          <b>
            <Icon name="target" size={24} /> {acc}%
          </b>
        </div>
        <div className="tile-stat blue">
          <span>Время</span>
          <b>
            <Icon name="clock" size={22} /> {fmtDuration(summary.ms)}
          </b>
        </div>
      </div>
      <div className="done-extra">
        <span className="pill gold">
          +{summary.nuts} <Icon name="nut" size={16} />
        </span>
        {summary.heartsGained > 0 && (
          <span className="pill red">
            +1 <Icon name="heart" size={16} />
          </span>
        )}
        {summary.goalReached && <span className="pill green">🎯 Цель дня выполнена!</span>}
      </div>
      <button className="btn lg block done-btn" onClick={nextStep}>
        Продолжить
      </button>
    </div>
  );
}
