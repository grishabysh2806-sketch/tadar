import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import './styles/base.css';
import './styles/layout.css';
import './styles/learn.css';
import './styles/lesson.css';
import './styles/pages.css';
import App from './App';
import { initVoices } from './audio/voice';
import { unlockAudio } from './audio/engine';
import { connectCloud, flushCloud } from './lib/cloud';

initVoices();

if (import.meta.env.DEV) {
  import('./state/store').then((m) => ((window as unknown as Record<string, unknown>).__store = m));
  import('./state/game').then((m) => ((window as unknown as Record<string, unknown>).__game = m));
}
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlockAudio, { once: true, passive: true }));

// PWA: офлайн-кэш только в собранной версии и вне встраиваемых окон
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.top === window && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  });
}

// Прогресс в личном хранилище просмотрщика claude.ai — после первого кадра, без вопросов при открытии
setTimeout(() => connectCloud(false), 600);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushCloud();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
