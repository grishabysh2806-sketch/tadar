/* Общие части режима «Класс»: QR-код, новое задание, выгрузка таблицы. */
import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { UNITS } from '../data/course';
import { Mascot, Modal, toast } from '../ui/kit';
import { addDays, dayKey } from '../lib/util';
import { saveFile, copyText } from '../lib/platform';

export function QR({ text, size = 168 }: { text: string; size?: number }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(unescape(encodeURIComponent(text)));
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  return <div className="qr" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export const joinUrl = (code: string) => `${location.origin}${location.pathname}#/join/${code}`;

export function ClassPitch({ online }: { online?: boolean }) {
  return (
    <div className="card flat class-pitch">
      <Mascot pose="head" size={70} />
      <p>
        Шорский изучают в школах юга Кузбасса. «Класс» даёт учителю интерактивные задания и живую практику учеников вне урока.{' '}
        {online
          ? 'Ученики вступают по коду с любого устройства, а учитель сразу видит их опыт, уроки и выполненные задания.'
          : 'Сейчас это демо: ученики класса — пример, данные хранятся на устройстве.'}
      </p>
    </div>
  );
}

export function NewTaskModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (lessonId: string, due: string) => Promise<void> | void }) {
  const [unit, setUnit] = useState('u1');
  const [lesson, setLesson] = useState('u1l1');
  const [due, setDue] = useState(addDays(dayKey(), 7));
  const [busy, setBusy] = useState(false);
  const u = UNITS.find((x) => x.id === unit)!;
  return (
    <Modal open={open} onClose={onClose}>
      <h2>Новое задание</h2>
      <div className="col">
        <label>
          <span className="label">Раздел</span>
          <select
            className="input"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setLesson(UNITS.find((x) => x.id === e.target.value)!.lessons[0].id);
            }}
          >
            {UNITS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.n}. {x.shorTitle} — {x.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Урок</span>
          <select className="input" value={lesson} onChange={(e) => setLesson(e.target.value)}>
            {u.lessons.map((l, i) => (
              <option key={l.id} value={l.id}>
                Урок {i + 1}: {l.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Срок</span>
          <input className="input" type="date" value={due} min={dayKey()} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button
          className="btn green lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onCreate(lesson, due);
              toast('Задание отправлено классу', { icon: '📬' });
              onClose();
            } catch {
              toast('Не удалось задать урок', { icon: '⚠️', sub: 'Проверьте интернет и попробуйте ещё раз' });
            } finally {
              setBusy(false);
            }
          }}
        >
          Задать
        </button>
      </div>
    </Modal>
  );
}

/** Таблица для Excel: точка с запятой, кавычки, BOM для кириллицы. */
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');

export async function copyTable(csv: string) {
  const ok = await copyText(csv);
  toast(ok ? 'Таблица скопирована' : 'Не удалось скопировать', { icon: ok ? '📋' : '⚠️', sub: ok ? 'Вставьте её в Excel или Google Таблицы' : undefined });
}

export async function saveTable(name: string, csv: string) {
  const res = await saveFile(`tadar-${name.replace(/[^\p{L}\p{N}]+/gu, '-')}.csv`, '﻿' + csv);
  if (res === 'saved') toast('Таблица сохранена', { icon: '📊' });
  else if (res === 'failed') await copyTable(csv);
}
