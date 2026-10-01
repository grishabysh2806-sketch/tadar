import { useState } from 'react';
import { setState, useStore, type Mode } from '../state/store';
import { Mascot, MASCOT_NAME, Modal } from '../ui/kit';
import { serverOn } from '../net/client';
import { EmailFlow } from './Account';
import { Icon } from '../ui/Icon';
import { navigate } from '../lib/router';
import { cx } from '../lib/util';
import { sfx } from '../audio/engine';
import { Logo } from '../layout/Layout';

const MOTIVES: { id: string; icon: string; title: string; mode: Mode; role?: 'teacher' | 'student' }[] = [
  { id: 'family', icon: '👵', title: 'Говорить с бабушкой и дедушкой', mode: 'learner' },
  { id: 'school', icon: '🏫', title: 'Учу шорский в школе', mode: 'class', role: 'student' },
  { id: 'teacher', icon: '🎓', title: 'Учу других или буду учителем', mode: 'class', role: 'teacher' },
  { id: 'travel', icon: '🎿', title: 'Еду в Горную Шорию', mode: 'traveler' },
  { id: 'culture', icon: '📜', title: 'Интересны культура и эпос', mode: 'learner' },
  { id: 'roots', icon: '🌲', title: 'Хочу знать язык своих предков', mode: 'learner' },
];

const MODES: { id: Mode; icon: 'learn' | 'school' | 'travel'; title: string; text: string }[] = [
  { id: 'learner', icon: 'learn', title: 'Ученик', text: '45 игровых уроков, эпос кай, «Голоса старших»' },
  { id: 'class', icon: 'school', title: 'Класс', text: 'Задания и прогресс учеников для учителей школ' },
  { id: 'traveler', icon: 'travel', title: 'Путешественник', text: 'Первые слова, разговорник и карта Горной Шории' },
];

const GOALS = [
  { xp: 10, min: 5, title: 'Лёгкая' },
  { xp: 20, min: 10, title: 'Обычная' },
  { xp: 30, min: 15, title: 'Серьёзная' },
  { xp: 50, min: 20, title: 'Богатырская' },
];

export default function Onboarding() {
  const st = useStore((s) => s.settings);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [motive, setMotive] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(st.mode);
  const [goal, setGoal] = useState(20);
  const [login, setLogin] = useState(false);
  const motiveDef = MOTIVES.find((m) => m.id === motive);

  const go = (n: number) => {
    sfx('tap');
    setStep(n);
  };

  const finish = (target: string) => {
    // пришли по QR-коду класса — после знакомства сразу в класс
    let joining = false;
    try {
      joining = !!sessionStorage.getItem('tadar.join');
    } catch {
      /* noop */
    }
    setState((d) => {
      d.profile.name = name.trim();
      d.profile.motivation = motive ?? undefined;
      d.settings.mode = joining ? 'class' : mode;
      d.settings.goal = goal;
      d.settings.onboarded = true;
      if (joining) d.cls.role = 'student';
      else if (mode === 'class' && motiveDef?.role) d.cls.role = motiveDef.role;
    });
    sfx('unlock');
    navigate(joining ? 'class' : target, true);
  };

  if (step === 0) {
    return (
      <div className="onb splash">
        <div className="splash-sky" />
        <div className="splash-content">
          <Logo light />
          <Mascot pose="hero" size={230} anim="bob" className="splash-mascot" />
          <h1>Шорский язык — играючи</h1>
          <p>Уроки по 5 минут, живые голоса и эпос кай. Чтобы шорский язык звучал в каждом телефоне!</p>
          <div className="col splash-btns">
            <button className="btn white lg block" onClick={() => go(1)}>
              Начать
            </button>
            <button className="btn outline-white block" onClick={() => navigate('about')}>
              О проекте «Тадар»
            </button>
            {serverOn && (
              <button className="btn text splash-login" onClick={() => setLogin(true)}>
                Уже занимались? Войти по почте
              </button>
            )}
          </div>
        </div>
        <Modal open={login} onClose={() => setLogin(false)}>
          <h2>Вход по почте</h2>
          <p className="muted" style={{ marginBottom: 14 }}>
            Если вы привязали почту на другом устройстве, введите её — пришлём код, и прогресс вернётся сюда.
          </p>
          <EmailFlow mode="login" onDone={() => setLogin(false)} onCancel={() => setLogin(false)} />
        </Modal>
      </div>
    );
  }

  const total = 5;
  return (
    <div className="onb">
      <header className="onb-top">
        <button className="icon-btn" onClick={() => go(step - 1)} aria-label="Назад">
          <Icon name="arrow-left" size={24} />
        </button>
        <div className="bar grow">
          <i style={{ width: `${(step / total) * 100}%` }} />
        </div>
      </header>

      <main className="onb-body" key={step}>
        {step === 1 && (
          <div className="onb-step rise">
            <div className="onb-say">
              <Mascot pose="point-r" size={130} anim="sway" />
              <div className="bubble">
                <b>Эзен!</b> Я {MASCOT_NAME} — по-шорски это «волк». Буду вашим проводником по урокам. А как вас зовут?
              </div>
            </div>
            <input className="input" placeholder="Ваше имя" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go(2)} />
          </div>
        )}
        {step === 2 && (
          <div className="onb-step rise">
            <div className="onb-say">
              <Mascot pose="head-r" size={90} />
              <div className="bubble">{name ? `${name}, зачем` : 'Зачем'} вы учите шорский?</div>
            </div>
            <div className="onb-options">
              {MOTIVES.map((m) => (
                <button
                  key={m.id}
                  className={cx('opt', motive === m.id && 'sel')}
                  onClick={() => {
                    setMotive(m.id);
                    setMode(m.mode);
                    sfx('select');
                  }}
                >
                  <span className="onb-emoji">{m.icon}</span>
                  <span className="opt-body">{m.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="onb-step rise">
            <div className="onb-say">
              <Mascot pose="head-r" size={90} />
              <div className="bubble">Выберите режим — его можно сменить в любой момент в настройках.</div>
            </div>
            <div className="onb-modes">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={cx('opt mode-opt', mode === m.id && 'sel')}
                  onClick={() => {
                    setMode(m.id);
                    sfx('select');
                  }}
                >
                  <Icon name={m.icon} size={44} />
                  <span className="opt-body">
                    <b>{m.title}</b>
                    <small>{m.text}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="onb-step rise">
            <div className="onb-say">
              <Mascot pose="head-r" size={90} />
              <div className="bubble">Сколько времени в день вы готовы уделять шорскому?</div>
            </div>
            <div className="onb-options single">
              {GOALS.map((g) => (
                <button
                  key={g.xp}
                  className={cx('opt goal-opt', goal === g.xp && 'sel')}
                  onClick={() => {
                    setGoal(g.xp);
                    sfx('select');
                  }}
                >
                  <span className="opt-body">
                    <b>{g.min} минут в день</b>
                  </span>
                  <span className="muted">
                    {g.title} · {g.xp} опыта
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="onb-step rise center onb-final">
            <Mascot pose="hero" size={210} anim="jump" />
            <h1>{name ? `Отлично, ${name}!` : 'Отлично!'}</h1>
            <p className="muted">
              {mode === 'traveler'
                ? 'Начнём с мини-курса для путешественников: приветствия, дорога и места Горной Шории.'
                : mode === 'class'
                  ? 'Режим «Класс» готов: учитель создаёт класс и задания, ученики вступают по коду.'
                  : 'Первый урок — приветствия. Всего пять минут, и вы скажете первые слова по-шорски.'}
            </p>
          </div>
        )}
      </main>

      <footer className="onb-foot">
        {step < 5 ? (
          <button className={cx('btn green lg block', step === 2 && !motive && 'disabled')} disabled={step === 2 && !motive} onClick={() => go(step + 1)}>
            {step === 1 && !name.trim() ? 'Пропустить' : 'Дальше'}
          </button>
        ) : (
          <div className="col" style={{ width: '100%' }}>
            {mode === 'traveler' ? (
              <button className="btn green lg block" onClick={() => finish('travel')}>
                К мини-курсу
              </button>
            ) : mode === 'class' ? (
              <button className="btn green lg block" onClick={() => finish('class')}>
                Открыть «Класс»
              </button>
            ) : (
              <button className="btn green lg block" onClick={() => finish('lesson/u1l1')}>
                Начать первый урок
              </button>
            )}
            <button className="btn text block" onClick={() => finish('learn')}>
              Сначала осмотреться
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
