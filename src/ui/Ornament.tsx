import { useId, type CSSProperties } from 'react';

/* Шорский орнамент «бараньи рога» (кочкар мӱӱс) — мотив из презентации. */

const MOTIF =
  'M20 44V20 M20 20C20 11 12 6.5 7.5 10.5 4.5 13.3 6.5 18.5 10.8 17.6 13.4 17 13.4 13.6 11.3 13.1 M20 20C20 11 28 6.5 32.5 10.5 35.5 13.3 33.5 18.5 29.2 17.6 26.6 17 26.6 13.6 28.7 13.1';

export function Motif({ size = 40, color = 'currentColor', style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" style={style} aria-hidden>
      <path d={MOTIF} fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="45.5" r="2.4" fill={color} />
    </svg>
  );
}

/** Кольцо из мотивов — «солнце» с орнаментом. */
export function OrnamentRing({
  size = 300,
  color = '#F8B818',
  count = 16,
  fill,
  style,
  className,
}: {
  size?: number;
  color?: string;
  count?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const items = Array.from({ length: count });
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={style} className={className} aria-hidden>
      {fill && <circle cx="200" cy="200" r="132" fill={fill} />}
      <circle cx="200" cy="200" r="150" fill="none" stroke={color} strokeOpacity=".7" strokeWidth="2.5" />
      <circle cx="200" cy="200" r="160" fill="none" stroke={color} strokeOpacity=".55" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
      {items.map((_, i) => (
        <g key={i} transform={`rotate(${(360 / count) * i} 200 200) translate(180 6)`}>
          <path d={MOTIF} fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="45.5" r="2.6" fill={color} />
        </g>
      ))}
    </svg>
  );
}

/** Полоса орнамента для разделителей: мотив повторяется без растяжения. */
export function OrnamentBand({ color = 'currentColor', height = 22, opacity = 1 }: { color?: string; height?: number; opacity?: number }) {
  const id = 'orn-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const k = height / 24;
  return (
    <svg width="100%" height={height} aria-hidden style={{ opacity, display: 'block' }}>
      <defs>
        <pattern id={id} width={44 * k} height={height} patternUnits="userSpaceOnUse">
          <path
            transform={`scale(${k})`}
            d="M22 22V12 M22 12C22 7 17.5 4.5 15 6.8 13.3 8.4 14.4 11.3 16.8 10.8 18.3 10.5 18.3 8.6 17.1 8.3 M22 12C22 7 26.5 4.5 29 6.8 30.7 8.4 29.6 11.3 27.2 10.8 25.7 10.5 25.7 8.6 26.9 8.3"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Силуэт гор Шории. */
export function Mountains({ className, colors = ['#1d63a8', '#165091', '#0f3d73'] }: { className?: string; colors?: string[] }) {
  return (
    <svg className={className} viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M0 120 L90 80 L160 110 L250 50 L330 100 L420 40 L520 105 L610 60 L700 100 L800 70 V200 H0Z" fill={colors[0]} />
      <path d="M0 150 L70 120 L140 140 L230 95 L300 135 L380 105 L470 145 L560 110 L650 140 L730 115 L800 135 V200 H0Z" fill={colors[1]} />
      <g fill={colors[2]}>
        <path d="M0 200 V165 L40 150 L80 168 L120 152 L170 172 L220 156 L270 174 L330 158 L390 176 L450 160 L510 178 L570 162 L630 176 L690 160 L750 174 L800 165 V200Z" />
        {Array.from({ length: 26 }).map((_, i) => {
          const x = i * 32 + (i % 3) * 6;
          const h = 22 + ((i * 37) % 18);
          return <path key={i} d={`M${x} 178 L${x + 8} ${178 - h} L${x + 16} 178Z`} />;
        })}
      </g>
    </svg>
  );
}

/** Иллюстрация-сцена для карточек эпоса. */
export function EpicScene({ scene, locked }: { scene: string; locked?: boolean }) {
  const sky = locked ? ['#2a3a52', '#1b2a3f'] : ['#0e2a52', '#081a33'];
  const sun = locked ? '#5d6b80' : '#F8B818';
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`sky-${scene}-${locked ? 1 : 0}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[1]} />
          <stop offset="1" stopColor={sky[0]} />
        </linearGradient>
        <radialGradient id={`sun-${scene}-${locked ? 1 : 0}`} cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor={locked ? '#7c899c' : '#FFE07A'} />
          <stop offset="1" stopColor={sun} />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#sky-${scene}-${locked ? 1 : 0})`} />
      {[...Array(18)].map((_, i) => (
        <circle key={i} cx={(i * 53) % 320} cy={(i * 29) % 90} r={i % 4 === 0 ? 1.4 : 0.8} fill="#fff" opacity={0.6} />
      ))}
      {scene !== 'taiga' && <circle cx={scene === 'sky' ? 160 : 230} cy={scene === 'fire' ? 150 : 78} r={scene === 'sky' ? 46 : 38} fill={`url(#sun-${scene}-${locked ? 1 : 0})`} />}
      {scene === 'taiga' && <circle cx="250" cy="40" r="16" fill={locked ? '#7c899c' : '#FFF2C2'} />}
      <path d="M0 130 L50 98 L95 120 L150 70 L200 112 L245 82 L320 118 V180 H0Z" fill={locked ? '#33465f' : '#1d63a8'} />
      <path d="M0 150 L60 128 L120 146 L180 118 L250 145 L320 130 V180 H0Z" fill={locked ? '#26384f' : '#134a85'} />
      {scene === 'horse' && (
        <path
          d="M118 150c6-14 18-22 34-22 6-8 14-12 22-12l4-7 3 7c6 2 9 7 8 12l-8-2c-2 6-6 10-12 12l-2 16h-6l-1-12c-8 2-18 2-26-1l-6 13h-6l3-15c-4 2-8 4-9 11z"
          fill={locked ? '#1a2a3e' : '#0a1f3d'}
        />
      )}
      {scene === 'fire' && (
        <g>
          <path d="M160 168c-14 0-22-9-22-20 0-9 6-14 11-19 4-5 7-9 6-16 9 6 16 14 18 24 3-3 4-7 4-11 6 6 7 13 7 19 0 13-10 23-24 23z" fill={locked ? '#556377' : '#F8B818'} />
          <path d="M160 168c-6 0-10-5-10-10 0-5 3-8 6-10 2-2 3-4 3-7 5 3 9 8 9 14 0 7-3 13-8 13z" fill={locked ? '#7c899c' : '#FFE07A'} />
        </g>
      )}
      {scene === 'river' && <path d="M0 165 C60 150 100 175 160 160 S260 150 320 162 V180 H0Z" fill={locked ? '#3f5470' : '#139FE0'} opacity=".85" />}
      {(scene === 'taiga' || scene === 'mountain') &&
        [...Array(14)].map((_, i) => {
          const x = i * 24 + 4;
          const h = 22 + ((i * 13) % 16);
          return <path key={i} d={`M${x} 172 L${x + 9} ${172 - h} L${x + 18} 172Z`} fill={locked ? '#1a2a3e' : '#0b2f5a'} />;
        })}
    </svg>
  );
}
