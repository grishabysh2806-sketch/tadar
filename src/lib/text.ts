/* Нормализация и проверка ответов. */

const SHOR_TO_PLAIN: Record<string, string> = { ғ: 'г', қ: 'к', ң: 'н', ӧ: 'о', ӱ: 'у', ё: 'е' };

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[‐‑–—-]/g, ' ')
    .replace(/[!?.,:;«»"“”„'’()…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function plain(s: string): string {
  return normalize(s).replace(/[ғқңӧӱ]/g, (c) => SHOR_TO_PLAIN[c] ?? c);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export interface Check {
  ok: boolean;
  /** Принято с небольшой опечаткой. */
  typo?: boolean;
  /** Принято, но без особых букв ғ қ ң ӧ ӱ. */
  letters?: boolean;
  /** Эталон, ближайший к ответу. */
  best: string;
}

function allowedDistance(len: number) {
  if (len >= 10) return 2;
  if (len >= 5) return 1;
  return 0;
}

/** Проверка ответа на шорском. */
export function checkShor(input: string, expected: string[]): Check {
  const n = normalize(input);
  let best = expected[0];
  let bestD = Infinity;
  for (const e of expected) {
    const ne = normalize(e);
    if (n === ne) return { ok: true, best: e };
    const d = levenshtein(n, ne);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  for (const e of expected) {
    if (plain(input) === plain(e)) return { ok: true, letters: true, best: e };
  }
  const nb = normalize(best);
  if (bestD <= allowedDistance(nb.length)) return { ok: true, typo: true, best };
  return { ok: false, best };
}

/** Проверка ответа на русском (любое из допустимых значений). */
export function checkRu(input: string, accepted: string[]): Check {
  const n = normalize(input);
  const acc = accepted.map(normalize).filter(Boolean);
  if (!n) return { ok: false, best: accepted[0] };
  if (acc.includes(n)) return { ok: true, best: accepted[acc.indexOf(n)] };
  // «вода, река» — каждая часть допустима
  const parts = input
    .split(/[,;/]| или /)
    .map(normalize)
    .filter(Boolean);
  if (parts.length > 1 && parts.every((p) => acc.includes(p))) return { ok: true, best: accepted[0] };
  let best = accepted[0];
  let bestD = Infinity;
  acc.forEach((a, i) => {
    const d = levenshtein(n, a);
    if (d < bestD) {
      bestD = d;
      best = accepted[i];
    }
  });
  if (bestD <= allowedDistance(normalize(best).length)) return { ok: true, typo: true, best };
  return { ok: false, best };
}

/** Слова предложения для плиток: без пунктуации, в нижнем регистре. */
export function tokens(s: string): string[] {
  return s
    .replace(/[!?.,:;«»"“”„()…]/g, ' ')
    .replace(/\s+—\s+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && t !== '—')
    .map((t) => t.toLowerCase());
}

/** Слова для показа (с пунктуацией) — для подсказок по нажатию. */
export function displayTokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

export function sameTokens(a: string[], b: string[]) {
  return normalize(a.join(' ')) === normalize(b.join(' '));
}

export const SHOR_LETTERS = ['ғ', 'қ', 'ң', 'ӧ', 'ӱ'];

/** Подсветка особых букв: возвращает массив кусков. */
export function splitSpecial(s: string): { t: string; sp: boolean }[] {
  const out: { t: string; sp: boolean }[] = [];
  for (const ch of s) {
    const sp = /[ғқңӧӱҒҚҢӦӰ]/.test(ch);
    const last = out[out.length - 1];
    if (last && last.sp === sp && !sp) last.t += ch;
    else out.push({ t: ch, sp });
  }
  return out;
}
