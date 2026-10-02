/*
 * Предложение создать аккаунт — гостям (аккаунт без почты).
 * Карточки в разных местах и экран после урока открывают одно окно:
 * почта → ссылка из письма. «Позже» прячет предложение в этом месте на 3 дня.
 */
import { useState } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { Mascot, Modal } from '../ui/kit';
import { cx, DAY } from '../lib/util';
import { net, serverActive, store, useServer } from '../net/client';
import { EmailFlow } from './Account';

const HIDE_DAYS = 3;
const hideKey = (place: string) => 'tadar.signup.' + place;

export function signupHidden(place: string) {
  try {
    return Date.now() - Number(localStorage.getItem(hideKey(place)) || 0) < HIDE_DAYS * DAY;
  } catch {
    return false;
  }
}

export function hideSignup(place: string) {
  try {
    localStorage.setItem(hideKey(place), String(Date.now()));
  } catch {
    /* noop */
  }
}

/** Гость: сервер работает, вход есть, но аккаунт ещё без почты. */
export function useGuest() {
  const n = net.use();
  const server = useServer();
  return server && n.status === 'online' && n.anonymous;
}

/** То же вне компонентов (например, при сборке шагов после урока). */
export const isGuestNow = () => serverActive() && net.get().status === 'online' && net.get().anonymous;

const ui = store<{ open: boolean; mode: 'link' | 'login' }>({ open: false, mode: 'link' });
export const openSignup = (mode: 'link' | 'login' = 'link') => ui.set({ open: true, mode });

const BENEFITS: [IconName, string][] = [
  ['league', 'Соревнуйтесь с друзьями в недельной лиге'],
  ['flame', 'Серия, опыт и уроки не потеряются, даже если очистить браузер'],
  ['users', 'Продолжайте на телефоне и компьютере, учитесь в классе'],
];

export function Benefits({ small }: { small?: boolean }) {
  return (
    <ul className={cx('benefits', small && 'small')}>
      {BENEFITS.map(([icon, text]) => (
        <li key={text}>
          <Icon name={icon} size={small ? 20 : 24} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Окно создания аккаунта — одно на всё приложение. */
export function SignupModal() {
  const s = ui.use();
  const guest = useGuest();
  const close = () => ui.set({ open: false });
  return (
    <Modal open={s.open && guest} onClose={close}>
      <div className="signup col">
        <div className="signup-head">
          <Mascot pose="head" size={76} />
          <div>
            <h2>{s.mode === 'link' ? 'Создайте аккаунт' : 'Вход в аккаунт'}</h2>
            <p className="muted">{s.mode === 'link' ? 'Нужна только почта — без пароля. Весь прогресс останется с вами.' : 'Пришлём письмо со ссылкой для входа.'}</p>
          </div>
        </div>
        {s.mode === 'link' && <Benefits />}
        <EmailFlow key={s.mode} mode={s.mode} onDone={close} />
        <button className="btn text sm" onClick={() => ui.set({ mode: s.mode === 'link' ? 'login' : 'link' })}>
          {s.mode === 'link' ? 'У меня уже есть аккаунт' : 'Создать новый аккаунт'}
        </button>
      </div>
    </Modal>
  );
}

/** Карточка-предложение для гостей. */
export function SignupCard({ place, title, text, compact, className }: { place: string; title: string; text: string; compact?: boolean; className?: string }) {
  const guest = useGuest();
  const [hidden, setHidden] = useState(() => signupHidden(place));
  if (!guest || hidden) return null;
  return (
    <div className={cx('signup-card card', compact && 'compact', className)}>
      <Mascot pose="head" size={compact ? 52 : 72} />
      <div className="grow">
        <b>{title}</b>
        <p>{text}</p>
        <div className="row signup-actions">
          <button className="btn sm green" onClick={() => openSignup()}>
            Создать аккаунт
          </button>
          <button
            className="btn text sm"
            onClick={() => {
              hideSignup(place);
              setHidden(true);
            }}
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
