import { useMemo, useState } from 'react';
import { UNITS } from '../data/course';
import { ITEMS, ruShow } from '../data/vocab';
import { ALL_SENTENCES } from '../data/sentences';
import { useStore } from '../state/store';
import { strength, questEvent } from '../state/game';
import { Icon } from '../ui/Icon';
import { ShorText, SpeakButton, Modal } from '../ui/kit';
import { PageHead } from '../layout/Layout';
import { cx } from '../lib/util';
import { normalize, plain } from '../lib/text';
import { Picture } from '../lesson/exercises';
import type { Item } from '../data/types';
import { navigate } from '../lib/router';

export default function Dictionary() {
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState<string>('all');
  const [onlyLearned, setOnlyLearned] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);

  const rows = useMemo(() => {
    const nq = normalize(q);
    const pq = plain(q);
    return UNITS.filter((u) => unit === 'all' || u.id === unit).flatMap((u) =>
      u.lessons
        .flatMap((l) => l.items)
        .map((id) => ({ it: ITEMS[id], u }))
        .filter(({ it }) => !onlyLearned || s.items[it.id]?.c)
        .filter(({ it }) => !nq || plain(it.shor).includes(pq) || normalize(it.ru).includes(nq) || (it.alt ?? []).some((a) => normalize(a).includes(nq))),
    );
  }, [q, unit, onlyLearned, s.items]);

  const learned = Object.values(s.items).filter((x) => x.c > 0).length;
  const examples = (it: Item) => ALL_SENTENCES.filter((sn) => plain(sn.shor).split(' ').some((w) => w === plain(it.shor).replace(/-$/, '')) || plain(sn.shor).includes(plain(it.shor) + ' ')).slice(0, 4);

  return (
    <div className="page dictionary">
      <PageHead title="Словарь" sub={`${rows.length} слов · выучено ${learned}`} icon="book">
        <button className="btn sm" onClick={() => navigate('practice')} disabled={learned < 4}>
          <Icon name="dumbbell" size={18} /> Тренировка
        </button>
      </PageHead>
      <div className="dict-search">
        <Icon name="search" size={22} />
        <input className="input" placeholder="Поиск: «тағ» или «гора»" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips-scroll" style={{ marginBottom: 10 }}>
        <button className={cx('chip', unit === 'all' && 'on')} onClick={() => setUnit('all')}>
          Все разделы
        </button>
        {UNITS.map((u) => (
          <button key={u.id} className={cx('chip', unit === u.id && 'on')} onClick={() => setUnit(u.id)}>
            <ShorText text={u.shorTitle} />
          </button>
        ))}
      </div>
      <label className="set-row" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={onlyLearned} onChange={(e) => setOnlyLearned(e.target.checked)} /> <span>Только выученные</span>
      </label>
      <div className="dict-list">
        {rows.map(({ it, u }) => {
          const st = s.items[it.id];
          const str = st ? Math.round(strength(s, it.id)) : 0;
          return (
            <button key={it.id} className={cx('dict-row', !st?.c && 'new')} onClick={() => setOpen(it)}>
              <SpeakButton text={it.shor} size="sm" onPlay={() => questEvent('listen', 1)} />
              <span className="grow dr-main">
                <ShorText text={it.shor} />
                <small>{ruShow(it)}</small>
              </span>
              <span className="dr-unit" style={{ background: u.color }} title={u.title} />
              <span className="dr-str" title={st?.c ? `Запоминание: ${str}/5` : 'Ещё не изучено'}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} className={cx(i < str && 'on')} />
                ))}
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <p className="muted center" style={{ padding: 24 }}>Ничего не нашлось. Попробуйте написать без особых букв: «таг» найдёт «тағ».</p>}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="word-card">
            <Picture item={open} size="lg" />
            <div className="row" style={{ justifyContent: 'center' }}>
              <SpeakButton text={open.shor} size="lg" onPlay={() => questEvent('listen', 1)} />
              <SpeakButton text={open.shor} size="md" slow />
            </div>
            <h2>
              <ShorText text={open.shor} />
            </h2>
            <p className="wc-ru">{ruShow(open)}</p>
            {open.note && <p className="intro-note">{open.note}</p>}
            {examples(open).length > 0 && (
              <div className="wc-ex">
                <span className="eyebrow">Примеры</span>
                {examples(open).map((ex) => (
                  <div key={ex.id} className="gx">
                    <SpeakButton text={ex.shor} size="sm" />
                    <div>
                      <ShorText text={ex.shor} />
                      <small>{ex.ru}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
