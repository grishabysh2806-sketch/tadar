/*
 * Связь с окружением: обычный браузер/PWA или просмотрщик claude.ai.
 * В просмотрщике возможности (хранилище, сохранение файлов) приходят через
 * window.claude.use(name); вне его — обычные браузерные механизмы.
 */

type ClaudeHost = { use?: (name: string) => Promise<unknown> };

export function inFrame() {
  try {
    return window.top !== window;
  } catch {
    return true;
  }
}

/** Возможность просмотрщика или null, если её здесь нет. */
export async function useCapability<T>(name: string): Promise<T | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host || typeof host.use !== 'function') return null;
  try {
    return ((await host.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}

interface Downloads {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: string }>;
}

export type SaveOutcome = 'saved' | 'declined' | 'failed';

/** Сохранить файл: через просмотрщик (с подтверждением) или обычной загрузкой. */
export async function saveFile(filename: string, data: Blob | string): Promise<SaveOutcome> {
  const dl = await useCapability<Downloads>('downloads');
  if (dl) {
    try {
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed';
    }
  }
  if (inFrame()) return 'failed';
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Копирование в буфер с запасным вариантом через выделение текста. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
