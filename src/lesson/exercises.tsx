import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item, Sentence } from '../data/types';
import { ruShow } from '../data/vocab';
import type { Exercise } from './generate';
import { Icon } from '../ui/Icon';
import { Mascot, ShorText, SpeakButton } from '../ui/kit';
import { Motif } from '../ui/Ornament';
import { speakShor } from '../audio/voice';
import { sfx } from '../audio/engine';
import { cx, shuffle } from '../lib/util';
import { SHOR_LETTERS } from '../lib/text';
import { getState } from '../state/store';

export type Status = 'idle' | 'correct' | 'wrong';

export interface ExProps<A> {
  ex: Exercise;
  value: A | undefined;
  onChange: (v: A) => void;
  status: Status;
  /** Ответ проверен — взаимодействие закрыто. */
  locked: boolean;
}

/* ── Картинка слова ─────────────────────────────────────────── */

export function Picture({ item, size = 'md' }: { item: Item; size?: 'md' | 'lg' }) {
  if (item.swatch)
    return (
      <span className={cx('pic swatch', size)}>
        <i style={{ background: item.swatch }} />
      </span>
    );
  if (item.num !== undefined) return <span className={cx('pic num', size)}>{item.num}</span>;
  if (!item.emoji)
    return (
      <span className={cx('pic motif', size)} aria-hidden>
        <Motif size={size === 'lg' ? 46 : 30} color="currentColor" />
      </span>
    );
  return (
    <span className={cx('pic emoji', size)} aria-hidden>
      {item.emoji}
    </span>
  );
}

/* ── Подсказки к словам предложения ─────────────────────────── */

export function HintSentence({ sentence, speak = true }: { sentence: Sentence; speak?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const words = sentence.shor.split(/\s+/);
  useEffect(() => {
    if (open === null) return;
    const t = setTimeout(() => setOpen(null), 2600);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <span className="hint-sentence">
      {words.map((w, i) => (
        <span key={i} className="hw-wrap">
          <button
            type="button"
            className={cx('hw', open === i && 'on')}
            onClick={() => {
              setOpen(open === i ? null : i);
              if (speak) speakShor(w.replace(/[!?.,:;]/g, ''), { force: true });
            }}
          >
            <ShorText text={w} />
          </button>
          {open === i && sentence.gloss[i] && <span className="hw-tip">{sentence.gloss[i]}</span>}{' '}
        </span>
      ))}
    </span>
  );
}

/* ── Новое слово ────────────────────────────────────────────── */

export function IntroCard({ ex }: { ex: Extract<Exercise, { kind: 'intro' }> }) {
  const it = ex.item;
  return (
    <div className="ex-intro rise">
      <div className="new-badge">
        <Icon name="sparkles" size={16} /> Новое слово
      </div>
      <div className="intro-card">
        <Picture item={it} size="lg" />
        <div className="intro-word">
          <SpeakButton text={it.shor} size="lg" autoPlay={getState().settings.autoplay} />
          <ShorText text={it.shor} className="intro-shor" />
        </div>
        <div className="intro-ru">{ruShow(it)}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <SpeakButton text={it.shor} size="sm" slow />
          <small className="muted">медленно</small>
        </div>
        {it.note && (
          <p className="intro-note">
            <Icon name="info" size={18} style={{ color: 'var(--blue)', flex: 'none' }} /> {it.note}
          </p>
        )}
      </div>
      <div className="intro-mascot">
        <Mascot pose="head" size={74} />
        <div className="bubble">Послушайте и повторите вслух!</div>
      </div>
    </div>
  );
}

/* ── Выбор перевода ─────────────────────────────────────────── */

function OptionList({
  options,
  render,
  value,
  onChange,
  status,
  locked,
  correctId,
  grid,
  onPick,
}: {
  options: Item[];
  render: (o: Item) => React.ReactNode;
  value?: string;
  onChange: (v: string) => void;
  status: Status;
  locked: boolean;
  correctId: string;
  grid?: boolean;
  onPick?: (o: Item) => void;
}) {
  useEffect(() => {
    if (locked) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        onChange(options[n - 1].id);
        onPick?.(options[n - 1]);
        sfx('select');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [options, locked, onChange, onPick]);
  return (
    <div className={cx('options', grid && 'grid')}>
      {options.map((o, i) => {
        const sel = value === o.id;
        const st = locked ? (o.id === correctId ? 'right' : sel ? 'wrong' : 'dim') : sel ? 'sel' : '';
        return (
          <button
            key={o.id}
            type="button"
            className={cx('opt', st, status !== 'idle' && sel && status)}
            disabled={locked}
            onClick={() => {
              onChange(o.id);
              onPick?.(o);
              sfx('select');
            }}
          >
            <kbd>{i + 1}</kbd>
            <span className="opt-body">{render(o)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChooseRu({ ex, value, onChange, status, locked }: ExProps<string>) {
  if (ex.kind !== 'choose_ru') return null;
  const it = ex.item;
  return (
    <div className="ex rise">
      <p className="ex-q">
        Что значит слово «<ShorText text={it.shor} />»?
      </p>
      <div className="prompt-row">
        <Mascot pose="head" size={88} />
        <div className="bubble prompt-bubble">
          <SpeakButton text={it.shor} autoPlay={getState().settings.autoplay} />
          <ShorText text={it.shor} className="prompt-word" />
        </div>
      </div>
      <OptionList options={ex.options} render={(o) => ruShow(o)} value={value} onChange={onChange} status={status} locked={locked} correctId={it.id} />
    </div>
  );
}

export function ChooseShor({ ex, value, onChange, status, locked }: ExProps<string>) {
  if (ex.kind !== 'choose_shor') return null;
  const it = ex.item;
  return (
    <div className="ex rise">
      <p className="ex-q">
        Как будет «<b>{ruShow(it)}</b>» по-шорски?
      </p>
      <OptionList
        options={ex.options}
        render={(o) => <ShorText text={o.shor} />}
        value={value}
        onChange={onChange}
        status={status}
        locked={locked}
        correctId={it.id}
        onPick={(o) => speakShor(o.shor)}
      />
    </div>
  );
}

export function PictureChoice({ ex, value, onChange, locked }: ExProps<string>) {
  useEffect(() => {
    if (locked || ex.kind !== 'picture') return;
    const h = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= ex.options.length) onChange(ex.options[n - 1].id);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ex, locked, onChange]);
  if (ex.kind !== 'picture') return null;
  const it = ex.item;
  return (
    <div className="ex rise">
      <p className="ex-q">
        Что такое «<ShorText text={it.shor} />»?
      </p>
      <div className="row" style={{ justifyContent: 'center', marginBottom: 6 }}>
        <SpeakButton text={it.shor} autoPlay={getState().settings.autoplay} />
        <ShorText text={it.shor} className="prompt-word" />
      </div>
      <div className="pic-grid">
        {ex.options.map((o, i) => {
          const sel = value === o.id;
          const st = locked ? (o.id === it.id ? 'right' : sel ? 'wrong' : 'dim') : sel ? 'sel' : '';
          return (
            <button
              key={o.id}
              className={cx('pic-card', st)}
              disabled={locked}
              onClick={() => {
                onChange(o.id);
                sfx('select');
              }}
            >
              <Picture item={o} />
              <span className="pic-label">{locked ? ruShow(o) : <kbd>{i + 1}</kbd>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ListenChoice({ ex, value, onChange, status, locked }: ExProps<string>) {
  if (ex.kind !== 'listen') return null;
  const it = ex.item;
  return (
    <div className="ex rise">
      <p className="ex-q">Нажмите, чтобы прослушать, и выберите услышанное</p>
      <div className="listen-big">
        <SpeakButton text={it.shor} size="lg" autoPlay />
        <SpeakButton text={it.shor} size="md" slow />
      </div>
      <OptionList
        grid
        options={ex.options}
        render={(o) => <ShorText text={o.shor} />}
        value={value}
        onChange={onChange}
        status={status}
        locked={locked}
        correctId={it.id}
      />
    </div>
  );
}

/* ── Пары ───────────────────────────────────────────────────── */

export function MatchPairs({ ex, onDone, onMistake }: { ex: Extract<Exercise, { kind: 'match' }>; onDone: () => void; onMistake: () => void }) {
  const left = useMemo(() => shuffle(ex.pairs), [ex]);
  const right = useMemo(() => shuffle(ex.pairs), [ex]);
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [flash, setFlash] = useState<string[]>([]);
  const streak = useRef(0);

  useEffect(() => {
    if (!selL || !selR) return;
    if (selL === selR) {
      streak.current += 1;
      sfx('match', streak.current);
      setFlash([selL]);
      setDone((d) => [...d, selL]);
      setTimeout(() => setFlash([]), 450);
    } else {
      streak.current = 0;
      sfx('wrong');
      onMistake();
      setBad(['L' + selL, 'R' + selR]);
      setTimeout(() => setBad([]), 500);
    }
    setSelL(null);
    setSelR(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selL, selR]);

  useEffect(() => {
    if (done.length === ex.pairs.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <div className="ex rise">
      <p className="ex-q">Нажимайте на пары: слово — перевод</p>
      <div className="match">
        <div className="match-col">
          {left.map((it) => (
            <button
              key={it.id}
              className={cx('opt match-btn', selL === it.id && 'sel', done.includes(it.id) && (flash.includes(it.id) ? 'right' : 'gone'), bad.includes('L' + it.id) && 'wrong shake')}
              disabled={done.includes(it.id)}
              onClick={() => {
                setSelL(it.id);
                speakShor(it.shor);
              }}
            >
              <ShorText text={it.shor} />
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((it) => (
            <button
              key={it.id}
              className={cx('opt match-btn', selR === it.id && 'sel', done.includes(it.id) && (flash.includes(it.id) ? 'right' : 'gone'), bad.includes('R' + it.id) && 'wrong shake')}
              disabled={done.includes(it.id)}
              onClick={() => {
                setSelR(it.id);
                sfx('select');
              }}
            >
              {ruShow(it)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Сборка фразы ───────────────────────────────────────────── */

export function BuildSentence({ ex, value, onChange, locked }: ExProps<number[]>) {
  if (ex.kind !== 'build') return null;
  const chosen = value ?? [];
  const toShor = ex.dir === 'ru2shor';
  return (
    <div className="ex rise">
      <p className="ex-q">{toShor ? 'Переведите на шорский' : 'Переведите на русский'}</p>
      <div className="prompt-row">
        <Mascot pose="head" size={88} />
        <div className="bubble prompt-bubble sentence">
          {toShor ? (
            <span className="ru-sentence">{ex.sentence.ru}</span>
          ) : (
            <>
              <SpeakButton text={ex.sentence.shor} autoPlay={getState().settings.autoplay} />
              <HintSentence sentence={ex.sentence} />
            </>
          )}
        </div>
      </div>
      <div className={cx('answer-lines', locked && 'locked')}>
        {chosen.map((ti) => (
          <button
            key={ti}
            className="tile"
            disabled={locked}
            onClick={() => {
              sfx('pop');
              onChange(chosen.filter((x) => x !== ti));
            }}
          >
            {toShor ? <ShorText text={ex.tiles[ti]} /> : ex.tiles[ti]}
          </button>
        ))}
      </div>
      <div className="tile-bank">
        {ex.tiles.map((t, i) => {
          const used = chosen.includes(i);
          return (
            <span key={i} className="tile-slot">
              <button
                className={cx('tile', used && 'used')}
                disabled={used || locked}
                onClick={() => {
                  sfx('pop');
                  if (toShor) speakShor(t);
                  onChange([...chosen, i]);
                }}
              >
                {toShor ? <ShorText text={t} /> : t}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── Ввод текста ────────────────────────────────────────────── */

function ShorKeyboard({ onKey, disabled }: { onKey: (ch: string) => void; disabled?: boolean }) {
  return (
    <div className="shor-kb" aria-label="Особые буквы">
      {SHOR_LETTERS.map((l) => (
        <button key={l} type="button" className="kb-key" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => onKey(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function TextAnswer({ value, onChange, locked, shor, placeholder, onEnter }: { value: string; onChange: (v: string) => void; locked: boolean; shor: boolean; placeholder: string; onEnter?: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!locked) setTimeout(() => ref.current?.focus({ preventScroll: true }), 300);
  }, [locked]);
  const insert = (ch: string) => {
    const el = ref.current;
    if (!el) return onChange(value + ch);
    const a = el.selectionStart ?? value.length;
    const b = el.selectionEnd ?? value.length;
    const next = value.slice(0, a) + ch + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + ch.length, a + ch.length);
    });
  };
  return (
    <div className="text-answer">
      <textarea
        ref={ref}
        className="input type-input"
        value={value}
        disabled={locked}
        lang={shor ? 'cjs' : 'ru'}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.();
          }
        }}
      />
      {shor && <ShorKeyboard onKey={insert} disabled={locked} />}
    </div>
  );
}

export function TypeAnswer({ ex, value, onChange, locked, onEnter }: ExProps<string> & { onEnter: () => void }) {
  if (ex.kind !== 'type') return null;
  const it = ex.item;
  const toShor = ex.dir === 'ru2shor';
  return (
    <div className="ex rise">
      <p className="ex-q">{toShor ? 'Напишите по-шорски' : 'Напишите перевод на русский'}</p>
      <div className="prompt-row">
        <Mascot pose="head" size={88} />
        <div className="bubble prompt-bubble">
          {toShor ? (
            <span className="ru-sentence">
              {ruShow(it)} <Picture item={it} />
            </span>
          ) : (
            <>
              <SpeakButton text={it.shor} autoPlay={getState().settings.autoplay} />
              <ShorText text={it.shor} className="prompt-word" />
            </>
          )}
        </div>
      </div>
      <TextAnswer value={value ?? ''} onChange={onChange} locked={locked} shor={toShor} placeholder={toShor ? 'Введите слово на шорском' : 'Введите перевод'} onEnter={onEnter} />
    </div>
  );
}

export function ListenType({ ex, value, onChange, locked, onEnter }: ExProps<string> & { onEnter: () => void }) {
  if (ex.kind !== 'listen_type') return null;
  return (
    <div className="ex rise">
      <p className="ex-q">Напишите, что услышали</p>
      <div className="listen-big">
        <SpeakButton text={ex.item.shor} size="lg" autoPlay />
        <SpeakButton text={ex.item.shor} size="md" slow />
      </div>
      <TextAnswer value={value ?? ''} onChange={onChange} locked={locked} shor placeholder="Введите услышанное слово" onEnter={onEnter} />
    </div>
  );
}

/* ── Пропущенное слово ──────────────────────────────────────── */

export function FillBlank({ ex, value, onChange, locked }: ExProps<string>) {
  if (ex.kind !== 'fill') return null;
  const words = ex.sentence.shor.split(/\s+/);
  const tail = words[ex.blank].replace(/^[^!?.,:;]+/, '');
  return (
    <div className="ex rise">
      <p className="ex-q">Вставьте пропущенное слово</p>
      <div className="fill-sentence">
        {words.map((w, i) =>
          i === ex.blank ? (
            <span key={i} className={cx('blank', value && 'filled')}>
              {value ? <ShorText text={value} /> : ' '}
              {tail}
            </span>
          ) : (
            <ShorText key={i} text={w} />
          ),
        )}
      </div>
      <p className="fill-ru">«{ex.sentence.ru}»</p>
      <div className="chips">
        {ex.options.map((o, i) => (
          <button
            key={o}
            className={cx('tile', value === o && 'sel', locked && (o === ex.answer ? 'right' : value === o ? 'wrong' : ''))}
            disabled={locked}
            onClick={() => {
              onChange(o);
              speakShor(o);
            }}
          >
            <kbd>{i + 1}</kbd> <ShorText text={o} />
          </button>
        ))}
      </div>
    </div>
  );
}
