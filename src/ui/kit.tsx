import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { splitSpecial } from '../lib/text';
import { speakShor } from '../audio/voice';
import { cx } from '../lib/util';
import { Pic } from './Pic';

/* ── Маскот ─────────────────────────────────────────────────── */

export const MASCOT_NAME = 'Пӧрӱ';

type Pose = 'point' | 'point-r' | 'hero' | 'hero-l' | 'head' | 'head-r';
const SRC: Record<Pose, string> = {
  point: 'img/mascot.webp',
  'point-r': 'img/mascot-r.webp',
  hero: 'img/mascot-hero.webp',
  'hero-l': 'img/mascot-hero-l.webp',
  head: 'img/mascot-head.webp',
  'head-r': 'img/mascot-head-r.webp',
};

export function Mascot({
  pose = 'point',
  size = 160,
  anim,
  className,
  style,
}: {
  pose?: Pose;
  size?: number;
  anim?: 'bob' | 'jump' | 'sway' | 'sad';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={SRC[pose]}
      alt={`Маскот ${MASCOT_NAME}`}
      width={size}
      height={size}
      draggable={false}
      className={cx('mascot', anim, pose.startsWith('head') && 'm-head', className)}
      style={{ width: size, height: 'auto', ...style }}
    />
  );
}

/* ── Шорский текст с подсветкой особых букв ─────────────────── */

export function ShorText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cx('shor', className)} lang="cjs">
      {splitSpecial(text).map((p, i) =>
        p.sp ? (
          <span key={i} className="sp">
            {p.t}
          </span>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </span>
  );
}

/* ── Кнопка озвучки ─────────────────────────────────────────── */

export function SpeakButton({
  text,
  size = 'md',
  slow,
  autoPlay,
  className,
  onPlay,
}: {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  slow?: boolean;
  autoPlay?: boolean;
  className?: string;
  onPlay?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const play = async () => {
    setBusy(true);
    onPlay?.();
    await speakShor(text, { slow, force: true });
    setBusy(false);
  };
  useEffect(() => {
    if (autoPlay) {
      const t = setTimeout(play, 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay]);
  const dim = size === 'lg' ? 64 : size === 'sm' ? 36 : 48;
  return (
    <button
      type="button"
      className={cx('speak-btn', size, slow && 'slow', busy && 'busy', className)}
      style={{ width: dim, height: dim }}
      onClick={(e) => {
        e.stopPropagation();
        play();
      }}
      aria-label={slow ? 'Прослушать медленно' : 'Прослушать'}
      title={slow ? 'Медленно' : 'Прослушать'}
    >
      <Icon name={slow ? 'turtle' : 'speaker'} size={size === 'lg' ? 32 : size === 'sm' ? 18 : 24} />
    </button>
  );
}

/* ── Модальное окно ─────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  children,
  wide,
  sheet,
  dismissable = true,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
  sheet?: boolean;
  dismissable?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className={cx('overlay', sheet && 'sheet-overlay')}
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={cx(sheet ? 'sheet' : 'modal', wide && 'wide', className)} role="dialog" aria-modal="true">
        {dismissable && onClose && !sheet && (
          <button className="icon-btn close" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={20} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── Тосты ──────────────────────────────────────────────────── */

interface ToastMsg {
  id: number;
  icon: ReactNode;
  title: string;
  sub?: string;
}
let toasts: ToastMsg[] = [];
const toastListeners = new Set<() => void>();
let toastId = 0;
export function toast(title: string, opts: { icon?: ReactNode; sub?: string; ms?: number } = {}) {
  const t: ToastMsg = { id: ++toastId, icon: opts.icon ?? '✨', title, sub: opts.sub };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l());
  }, opts.ms ?? 3200);
}
export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span className="t-icon">{typeof t.icon === 'string' ? <Pic e={t.icon} size={30} /> : t.icon}</span>
          <div>
            {t.title}
            {t.sub && <small>{t.sub}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Конфетти ───────────────────────────────────────────────── */

export function Confetti({ run = true, colors = ['#139FE0', '#38B868', '#F8B818', '#EF6461', '#8B5CF6', '#9FD3F5'] }: { run?: boolean; colors?: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!run) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
    };
    resize();
    const W = () => cv.width;
    const parts = Array.from({ length: 140 }, () => ({
      x: W() / 2 + (Math.random() - 0.5) * W() * 0.3,
      y: cv.height * 0.35,
      vx: (Math.random() - 0.5) * 18 * dpr,
      vy: (-Math.random() * 16 - 6) * dpr,
      r: (4 + Math.random() * 6) * dpr,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.3,
      shape: Math.random() < 0.3 ? 1 : 0,
    }));
    let raf = 0;
    let frame = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += 0.45 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.c;
        if (p.shape) {
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      if (frame < 220) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  return createPortal(<canvas ref={ref} className="confetti" style={{ width: '100%', height: '100%' }} aria-hidden />, document.body);
}

/* ── Аватар ─────────────────────────────────────────────────── */

const AV_COLORS = ['#139FE0', '#38B868', '#8B5CF6', '#EF6461', '#F29F05', '#0A3A6E'];
export function Avatar({ name, idx = 0, size = 40 }: { name: string; idx?: number; size?: number }) {
  const letter = (name || 'Т').trim()[0] ?? 'Т';
  return (
    <span className="avatar" style={{ width: size, height: size, background: AV_COLORS[idx % AV_COLORS.length], fontSize: size * 0.44 }}>
      {letter}
    </span>
  );
}

/* ── Числовой счётчик ───────────────────────────────────────── */

export function CountUp({ to, ms = 900, from = 0 }: { to: number; ms?: number; from?: number }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, from]);
  return <>{v}</>;
}

/* ── Кольцо прогресса ───────────────────────────────────────── */

export function Ring({ value, size = 96, stroke = 8, color = 'var(--gold)', track = 'var(--line)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx('switch', on && 'on')} onClick={() => onChange(!on)} />;
}
