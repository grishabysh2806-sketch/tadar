import { useState } from 'react';
import { ALPHABET, VOWEL_HARMONY, type Letter } from '../data/alphabet';
import { Icon } from '../ui/Icon';
import { ShorText, SpeakButton, Modal, Mascot } from '../ui/kit';
import { PageHead } from '../layout/Layout';
import { cx } from '../lib/util';
import { speakShor } from '../audio/voice';

export default function Alphabet() {
  const [open, setOpen] = useState<Letter | null>(null);
  const special = ALPHABET.filter((l) => l.special);
  return (
    <div className="page alphabet">
      <PageHead title="Алфавит и звуки" sub="33 русские буквы и 5 особых шорских" icon="abc" />

      <section className="abc-intro card">
        <Mascot pose="head" size={80} />
        <p>
          Современный шорский алфавит создан в 1988–1989 годах (автор — Э. Ф. Чиспияков). К русским буквам добавлены пять особых: <b>ғ, қ, ң, ӧ, ӱ</b>. Нажмите на букву, чтобы
          услышать примеры.
        </p>
      </section>

      <h2 className="sec-title">Особые буквы</h2>
      <div className="special-grid">
        {special.map((l) => (
          <button key={l.upper} className="special-card" onClick={() => setOpen(l)}>
            <span className="sc-letter">
              {l.upper}
              <small>{l.lower}</small>
            </span>
            <span className="sc-sound">{l.sound}</span>
            <span className="sc-ex">
              {l.examples?.slice(0, 2).map((e) => (
                <span key={e.shor}>
                  <ShorText text={e.shor} /> — {e.ru}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>

      <h2 className="sec-title">Весь алфавит</h2>
      <div className="abc-grid">
        {ALPHABET.map((l) => (
          <button
            key={l.upper}
            className={cx('abc-cell', l.special && 'special')}
            onClick={() => {
              if (l.examples?.length) speakShor(l.examples[0].shor, { force: true });
              setOpen(l);
            }}
          >
            {l.upper}
            {l.lower}
          </button>
        ))}
      </div>

      <section className="card harmony">
        <h3>Гармония гласных</h3>
        <p>В шорском слове гласные обычно одного ряда. От них зависят окончания.</p>
        <div className="harmony-rows">
          <div>
            <span className="eyebrow">Задние</span>
            <div className="vowels">
              {VOWEL_HARMONY.back.map((v) => (
                <span key={v} className="vowel back">
                  {v}
                </span>
              ))}
            </div>
            <small>
              <ShorText text="қастар" /> — гуси
            </small>
          </div>
          <div>
            <span className="eyebrow">Передние</span>
            <div className="vowels">
              {VOWEL_HARMONY.front.map((v) => (
                <span key={v} className="vowel front">
                  {v}
                </span>
              ))}
            </div>
            <small>
              <ShorText text="пӱрлер" /> — листья
            </small>
          </div>
        </div>
      </section>

      <Modal open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="letter-card center">
            <div className={cx('lc-big', open.special && 'special')}>
              {open.upper}
              {open.lower}
            </div>
            {open.sound && <span className="pill blue">звук {open.sound}</span>}
            {open.hint && <p className="lc-hint">{open.hint}</p>}
            {open.examples && (
              <div className="col" style={{ width: '100%' }}>
                {open.examples.map((e) => (
                  <div key={e.shor} className="gx">
                    <SpeakButton text={e.shor} size="sm" />
                    <div style={{ textAlign: 'left' }}>
                      <ShorText text={e.shor} />
                      <small>{e.ru}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!open.examples && !open.hint && <p className="muted">Читается так же, как в русском.</p>}
            <p className="muted lc-note">
              <Icon name="info" size={16} /> Синтез речи передаёт звуки приблизительно. Точное произношение — в записях носителей.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
