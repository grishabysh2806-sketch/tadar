import { useSyncExternalStore } from 'react';

/* Простой hash-роутер: #/learn, #/lesson/u1l1, #/epic/e1 … */

function current() {
  let h = window.location.hash.replace(/^#\/?/, '');
  try {
    h = decodeURIComponent(h);
  } catch {
    /* оставляем как есть */
  }
  return h || 'learn';
}

let snapshot = current();
const listeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  snapshot = current();
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
});

export function useRoute() {
  const path = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
  const [main, ...rest] = path.split('?')[0].split('/');
  return { path, main, rest };
}

export function navigate(path: string, replace = false) {
  const target = '#/' + path.replace(/^#?\/?/, '');
  if (replace) {
    try {
      history.replaceState(null, '', target);
      snapshot = current();
      listeners.forEach((l) => l());
    } catch {
      window.location.hash = target;
    }
  } else if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

export function back(fallback = 'learn') {
  if (history.length > 1) history.back();
  else navigate(fallback, true);
}
