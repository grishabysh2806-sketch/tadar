/* Аккаунт на сервере: гостевой вход, привязка почты, вход на другом устройстве. */
import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/kit';
import { navigate } from '../lib/router';
import { copyText } from '../lib/platform';
import { net, errorText } from '../net/client';
import { confirmLinkEmail, confirmLogin, linkEmail, retryNow, sendLoginCode, signOut } from '../net';

type Mode = 'link' | 'login';

function authError(e: unknown, mode: Mode, step: 'send' | 'code') {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  if (step === 'code' && (/otp_expired|invalid/i.test(code) || /expired|invalid/i.test(msg))) return 'Код не подошёл или устарел. Проверьте письмо или запросите новый код.';
  if (mode === 'login' && (/otp_disabled|signup_disabled|user_not_found/i.test(code) || /signups not allowed|not found/i.test(msg)))
    return 'Аккаунт с этой почтой не найден. Сначала привяжите почту в настройках на устройстве, где вы занимались.';
  if (mode === 'link' && (/email_exists|user_already_exists/i.test(code) || /already (been )?registered/i.test(msg))) return 'Эта почта уже привязана к другому аккаунту — войдите в него.';
  if (/email_address_invalid|validation_failed/i.test(code) || /invalid.*email|email.*invalid/i.test(msg)) return 'Проверьте адрес почты.';
  if (/rate_limit/i.test(code) || /rate limit|too many|seconds/i.test(msg)) return 'Письма можно отправлять не чаще раза в минуту. Подождите немного.';
  return errorText(e);
}

/** Почта → код из письма. Подходит и для привязки, и для входа. */
export function EmailFlow({ mode, onDone, onCancel }: { mode: Mode; onDone?: () => void; onCancel?: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'link') await linkEmail(email);
      else await sendLoginCode(email);
      setSent(true);
    } catch (e) {
      setError(authError(e, mode, 'send'));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'link') await confirmLinkEmail(email, code);
      else await confirmLogin(email, code);
      toast(mode === 'link' ? 'Почта привязана' : 'Вы вошли', { icon: '✅', sub: mode === 'link' ? 'Теперь прогресс можно продолжить на любом устройстве' : 'Загружаем ваш прогресс' });
      onDone?.();
    } catch (e) {
      setError(authError(e, mode, 'code'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="email-flow col">
      {!sent ? (
        <>
          <label>
            <span className="label">Электронная почта</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
          </label>
          <div className="row">
            {onCancel && (
              <button className="btn ghost grow" onClick={onCancel}>
                Отмена
              </button>
            )}
            <button className="btn grow" disabled={!valid || busy} onClick={send}>
              {busy ? 'Отправляем…' : 'Получить код'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Письмо ушло на <b>{email.trim()}</b>. Введите код из письма — или просто откройте ссылку из письма на этом устройстве.
          </p>
          <input
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Код из письма"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
          />
          <div className="row">
            <button className="btn ghost grow" disabled={busy} onClick={() => (setSent(false), setCode(''))}>
              Другая почта
            </button>
            <button className="btn green grow" disabled={code.length < 6 || busy} onClick={confirm}>
              {busy ? 'Проверяем…' : 'Подтвердить'}
            </button>
          </div>
        </>
      )}
      {error && <p className="rec-err">{error}</p>}
    </div>
  );
}

/** Раздел настроек «Аккаунт». */
export function AccountSection() {
  const n = net.use();
  const [flow, setFlow] = useState<Mode | null>(null);
  const [askOut, setAskOut] = useState(false);

  return (
    <section className="set-group card account">
      <h3>Аккаунт и синхронизация</h3>
      {n.status === 'online' && (
        <p className="set-cloud on">
          <Icon name="check" size={18} /> На связи: лиги, классы и «Голоса старших» общие для всех, прогресс сохраняется на сервере.
        </p>
      )}
      {(n.status === 'connecting' || n.status === 'wait') && <p className="set-cloud">Подключаемся к серверу…</p>}
      {n.status === 'offline' && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <p className="set-cloud grow">Нет связи с сервером. Прогресс сохраняется на устройстве и отправится, когда появится интернет.</p>
          <button className="btn sm" onClick={retryNow}>
            Повторить
          </button>
        </div>
      )}

      {n.uid &&
        (n.anonymous ? (
          <>
            <p className="muted set-hint">
              Сейчас у вас гостевой аккаунт на этом устройстве. Привяжите почту — тогда прогресс не потеряется и его можно продолжить на телефоне и компьютере.
            </p>
            {flow ? (
              <EmailFlow mode={flow} onDone={() => setFlow(null)} onCancel={() => setFlow(null)} />
            ) : (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn sm" disabled={n.status !== 'online'} onClick={() => setFlow('link')}>
                  <Icon name="lock" size={18} /> Привязать почту
                </button>
                <button className="btn sm ghost" disabled={n.status !== 'online'} onClick={() => setFlow('login')}>
                  У меня уже есть аккаунт
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="set-hint">
              Вы вошли как <b>{n.email}</b>. Прогресс одинаковый на всех устройствах, где вы вошли.
            </p>
            {askOut ? (
              <div className="row leave-confirm">
                <span className="grow">Выйти? Прогресс останется в аккаунте, а это устройство начнёт с чистого листа.</span>
                <button
                  className="btn sm red"
                  onClick={async () => {
                    await signOut();
                    setAskOut(false);
                    navigate('welcome', true);
                  }}
                >
                  Выйти
                </button>
                <button className="btn sm ghost" onClick={() => setAskOut(false)}>
                  Отмена
                </button>
              </div>
            ) : (
              <button className="btn sm ghost" onClick={() => setAskOut(true)}>
                Выйти из аккаунта
              </button>
            )}
          </>
        ))}

      {n.uid && (
        <p className="account-id">
          {n.moderator && <span className="pill blue">модератор «Голосов старших»</span>}
          <span>ID аккаунта: {n.uid.slice(0, 8)}…</span>
          <button
            className="btn text sm"
            onClick={async () => {
              const ok = await copyText(n.uid!);
              toast(ok ? 'ID скопирован' : 'Не удалось скопировать', { icon: '📋', sub: ok ? 'Он нужен администратору, чтобы выдать права модератора' : undefined });
            }}
          >
            Копировать
          </button>
        </p>
      )}
    </section>
  );
}
