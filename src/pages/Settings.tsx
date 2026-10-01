import { useEffect, useState, useSyncExternalStore } from 'react';
import { cloudStatus, onCloudStatus, connectCloud } from '../lib/cloud';
import { useStore, setState, replaceState, defaultState, type Mode, type Theme } from '../state/store';
import { Icon } from '../ui/Icon';
import { Switch, Modal, toast, ShorText } from '../ui/kit';
import { voiceOptions, onVoicesChange, pickVoice, voiceLabel, speakShor, ttsSupported } from '../audio/voice';
import { navigate } from '../lib/router';
import { PageHead } from '../layout/Layout';
import { cx } from '../lib/util';
import { sfx } from '../audio/engine';
import { serverOn } from '../net/client';
import { AccountSection } from './Account';

export default function Settings() {
  const st = useStore((s) => s.settings);
  const [voices, setVoices] = useState(voiceOptions());
  const [reset, setReset] = useState(false);
  useEffect(() => onVoicesChange(() => setVoices(voiceOptions())), []);
  useEffect(() => {
    const t = setTimeout(() => setVoices(voiceOptions()), 600);
    return () => clearTimeout(t);
  }, []);
  const set = <K extends keyof typeof st>(k: K, v: (typeof st)[K]) =>
    setState((d) => {
      d.settings[k] = v;
    });
  const current = pickVoice();
  const cloud = useSyncExternalStore(onCloudStatus, cloudStatus);

  return (
    <div className="page settings">
      <PageHead title="Настройки" icon="settings" />

      <section className="set-group card">
        <h3>Режим</h3>
        <div className="seg big">
          {(
            [
              ['learner', 'Ученик'],
              ['class', 'Класс'],
              ['traveler', 'Путешественник'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button key={m} className={cx(st.mode === m && 'on')} onClick={() => set('mode', m)}>
              {label}
            </button>
          ))}
        </div>
        <p className="muted set-hint">
          {st.mode === 'class' ? 'Учитель создаёт класс и задания, ученики вступают по коду.' : st.mode === 'traveler' ? 'Мини-курс первых слов, разговорник и карта Шории.' : 'Полный курс: 45 уроков, эпос кай и «Голоса старших».'}
        </p>
      </section>

      <section className="set-group card">
        <h3>Цель на день</h3>
        <div className="seg big">
          {[10, 20, 30, 50].map((g) => (
            <button key={g} className={cx(st.goal === g && 'on')} onClick={() => set('goal', g)}>
              {g} опыта
            </button>
          ))}
        </div>
      </section>

      <section className="set-group card">
        <h3>Звук и озвучка</h3>
        <label className="set-row">
          <span className="grow">Звуковые эффекты</span>
          <Switch on={st.sfx} onChange={(v) => (set('sfx', v), v && sfx('correct'))} label="Звуковые эффекты" />
        </label>
        <label className="set-row">
          <span className="grow">Озвучка шорских слов</span>
          <Switch on={st.tts} onChange={(v) => set('tts', v)} label="Озвучка" />
        </label>
        <label className="set-row">
          <span className="grow">Автопроигрывание в упражнениях</span>
          <Switch on={st.autoplay} onChange={(v) => set('autoplay', v)} label="Автопроигрывание" />
        </label>
        <label className="set-row">
          <span className="grow">Музыка в эпосе</span>
          <Switch on={st.music} onChange={(v) => set('music', v)} label="Музыка в эпосе" />
        </label>
        <div className="set-voice">
          <span className="label">Голос синтеза</span>
          {ttsSupported() ? (
            <>
              <select className="input" value={st.voice} onChange={(e) => set('voice', e.target.value)}>
                <option value="">Автоматически ({voiceLabel(current)})</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {voiceLabel(v)}
                  </option>
                ))}
              </select>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="grow muted" style={{ fontWeight: 700, fontSize: 14 }}>
                  Скорость: {st.rate.toFixed(2)}
                </span>
                <input type="range" min={0.6} max={1.1} step={0.05} value={st.rate} onChange={(e) => set('rate', Number(e.target.value))} />
                <button className="btn sm" onClick={() => speakShor('Эзеноқ! Қайде чатчаң?', { force: true })}>
                  <Icon name="speaker" size={18} /> Проба
                </button>
              </div>
              <p className="muted set-hint">
                Шорских голосов у браузеров пока нет — слова читает ближайший тюркский голос (турецкий, казахский), а без них — русский. Записи из «Голосов старших» звучат вместо синтеза. Пример: <ShorText text="Эзеноқ!" />
              </p>
            </>
          ) : (
            <p className="muted">Этот браузер не поддерживает синтез речи — слова будут звучать только из «Голосов старших».</p>
          )}
        </div>
      </section>

      <section className="set-group card">
        <h3>Уроки</h3>
        <label className="set-row">
          <span className="grow">
            Сердца
            <small>Ошибки отнимают сердца. Выключите для занятий в классе.</small>
          </span>
          <Switch on={st.hearts} onChange={(v) => set('hearts', v)} label="Сердца" />
        </label>
      </section>

      <section className="set-group card">
        <h3>Оформление</h3>
        <div className="seg big">
          {(
            [
              ['system', 'Как в системе'],
              ['light', 'Светлая'],
              ['dark', 'Тёмная'],
            ] as [Theme, string][]
          ).map(([t, label]) => (
            <button key={t} className={cx(st.theme === t && 'on')} onClick={() => set('theme', t)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {serverOn ? (
        <AccountSection />
      ) : (
        <section className="set-group card">
          <h3>Сохранение прогресса</h3>
          {cloud === 'on' && (
            <p className="set-cloud on">
              <Icon name="check" size={18} /> Прогресс сохраняется в вашем аккаунте Claude — продолжайте на любом устройстве.
            </p>
          )}
          {cloud === 'connecting' && <p className="set-cloud">Подключаем хранилище…</p>}
          {cloud === 'available' && (
            <div className="col" style={{ gap: 10 }}>
              <p className="set-cloud">Сейчас прогресс хранится только в этом браузере. Его можно сохранять в вашем аккаунте Claude.</p>
              <button className="btn sm" onClick={() => connectCloud(true)}>
                Сохранять в аккаунте
              </button>
            </div>
          )}
          {(cloud === 'off' || cloud === 'local-only') && (
            <p className="set-cloud">Прогресс хранится на этом устройстве, в браузере. Не очищайте данные сайта, чтобы его не потерять.</p>
          )}
        </section>
      )}

      <section className="set-group card">
        <h3>Данные</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn ghost sm" onClick={() => navigate('about')}>
            <Icon name="info" size={18} /> О проекте
          </button>
          <button
            className="btn ghost sm"
            onClick={() => {
              setState((d) => {
                d.settings.onboarded = false;
              });
              navigate('welcome');
            }}
          >
            Пройти знакомство заново
          </button>
          <button className="btn red sm" onClick={() => setReset(true)}>
            Сбросить прогресс
          </button>
        </div>
      </section>

      <Modal open={reset} onClose={() => setReset(false)}>
        <h2>Сбросить прогресс?</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Опыт, серия, уроки и достижения обнулятся{serverOn ? ' — и на этом устройстве, и в аккаунте' : ''}. Записи «Голосов старших» останутся.
        </p>
        <div className="row">
          <button className="btn ghost grow" onClick={() => setReset(false)}>
            Отмена
          </button>
          <button
            className="btn red grow"
            onClick={() => {
              const fresh = defaultState();
              replaceState(fresh);
              setReset(false);
              toast('Прогресс сброшен', { icon: '🧹' });
              navigate('welcome');
            }}
          >
            Сбросить
          </button>
        </div>
      </Modal>
    </div>
  );
}
