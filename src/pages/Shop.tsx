import { useEffect, useState } from 'react';
import { useStore, heartsNow, MAX_HEARTS } from '../state/store';
import { SHOP, canBuy, buy, type ShopKey } from '../state/game';
import { Icon, type IconName } from '../ui/Icon';
import { toast } from '../ui/kit';
import { sfx } from '../audio/engine';
import { PageHead } from '../layout/Layout';
import { cx } from '../lib/util';

export default function Shop() {
  const s = useStore((x) => x);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 10000);
    return () => clearInterval(t);
  }, []);
  const boostLeft = Math.max(0, Math.ceil((s.boost.xp2Until - Date.now()) / 60000));
  const status: Record<ShopKey, string> = {
    freeze: `Сейчас: ${s.streak.freezes} из 2`,
    hearts: s.settings.hearts ? `Сейчас: ${heartsNow(s)} из ${MAX_HEARTS}` : 'Сердца отключены',
    boost: boostLeft ? `Действует ещё ${boostLeft} мин` : 'Не активен',
  };
  return (
    <div className="page shop">
      <PageHead title="Лавка" sub="Тратьте кедровые орешки с пользой" icon="shop">
        <span className="nut-balance">
          <Icon name="nut" size={28} /> {s.nuts}
        </span>
      </PageHead>
      <div className="shop-list">
        {(Object.keys(SHOP) as ShopKey[]).map((k) => {
          const it = SHOP[k];
          const ok = canBuy(s, k);
          return (
            <div key={k} className="shop-item card">
              <span className={cx('shop-icon', k)}>
                <Icon name={it.icon as IconName} size={46} />
              </span>
              <div className="grow">
                <b>{it.title}</b>
                <p className="muted">{it.desc}</p>
                <small className="pill">{status[k]}</small>
              </div>
              <button
                className={cx('btn price', !ok.ok && 'disabled')}
                disabled={!ok.ok}
                title={ok.reason}
                onClick={() => {
                  buy(k);
                  sfx('chest');
                  toast('Покупка совершена', { icon: '🛍️', sub: it.title });
                }}
              >
                {it.price} <Icon name="nut" size={20} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="card flat shop-earn">
        <h3>Как заработать орешки</h3>
        <ul>
          <li>Урок — 5 орешков, без ошибок — ещё 5</li>
          <li>Сундуки на карте разделов — 15–35</li>
          <li>Задания дня — 10–20 за каждое</li>
          <li>Раздел пройден — 20 и фрагмент эпоса</li>
          <li>Цель дня выполнена — 5</li>
        </ul>
      </div>
    </div>
  );
}
