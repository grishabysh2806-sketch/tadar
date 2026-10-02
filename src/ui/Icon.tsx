import type { CSSProperties, ReactElement } from 'react';

/* Иконки рисуются в одном стиле: плоские, со скруглениями, с «бликом». */

export type IconName =
  | 'flame'
  | 'flame-off'
  | 'xp'
  | 'heart'
  | 'heart-off'
  | 'nut'
  | 'lock'
  | 'check'
  | 'close'
  | 'speaker'
  | 'speaker-off'
  | 'turtle'
  | 'mic'
  | 'play'
  | 'pause'
  | 'stop'
  | 'learn'
  | 'kai'
  | 'voices'
  | 'league'
  | 'quests'
  | 'shop'
  | 'profile'
  | 'more'
  | 'book'
  | 'abc'
  | 'school'
  | 'travel'
  | 'settings'
  | 'info'
  | 'chest'
  | 'chest-open'
  | 'trophy'
  | 'star'
  | 'bolt'
  | 'target'
  | 'gem'
  | 'freeze'
  | 'clock'
  | 'arrow-left'
  | 'arrow-right'
  | 'chevron-right'
  | 'chevron-down'
  | 'refresh'
  | 'trash'
  | 'download'
  | 'search'
  | 'plus'
  | 'edit'
  | 'qr'
  | 'copy'
  | 'map'
  | 'music'
  | 'music-off'
  | 'calendar'
  | 'users'
  | 'pin'
  | 'sparkles'
  | 'dumbbell'
  | 'keyboard';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const P: Record<IconName, () => ReactElement> = {
  flame: () => (
    <>
      <path d="M12.3 1.8c.7 3.3-1.1 5.1-2.9 7C7.7 10.6 6 12.4 6 15.2 6 19.1 8.7 22.2 12 22.2s6-3.1 6-7c0-2.6-1.1-4.5-2.4-6-.3 1.4-1 2.4-2 2.9.4-3.8-.4-7.6-1.3-10.3z" fill="#F8B818" />
      <path d="M12 22.2c-2.1 0-3.7-1.8-3.7-4 0-1.7.9-2.8 2-3.8.9-.8 1.7-1.7 1.7-3.1 1.8 1.3 3.7 3.5 3.7 6.9 0 2.2-1.6 4-3.7 4z" fill="#FFE27A" />
    </>
  ),
  'flame-off': () => (
    <>
      <path d="M12.3 1.8c.7 3.3-1.1 5.1-2.9 7C7.7 10.6 6 12.4 6 15.2 6 19.1 8.7 22.2 12 22.2s6-3.1 6-7c0-2.6-1.1-4.5-2.4-6-.3 1.4-1 2.4-2 2.9.4-3.8-.4-7.6-1.3-10.3z" fill="#C9D4E1" />
      <path d="M12 22.2c-2.1 0-3.7-1.8-3.7-4 0-1.7.9-2.8 2-3.8.9-.8 1.7-1.7 1.7-3.1 1.8 1.3 3.7 3.5 3.7 6.9 0 2.2-1.6 4-3.7 4z" fill="#E6ECF3" />
    </>
  ),
  xp: () => (
    <>
      <path d="M12 2.2l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 16.8 6.2 20l1.2-6.5-4.8-4.5 6.5-.8z" fill="#139FE0" stroke="#139FE0" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 5.6l1.7 3.6 3.6.4" fill="none" stroke="#8FD6F7" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  heart: () => (
    <>
      <path d="M12 21.2s-7.6-4.7-9.6-9.4C.9 8.3 3 4.4 6.9 4.4c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 3.9 4.5 7.4-2 4.7-9.6 9.4-9.6 9.4z" fill="#EF6461" />
      <path d="M6.4 7.2c-1.4.2-2.3 1.4-2.1 2.9" fill="none" stroke="#FFB3B1" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  'heart-off': () => <path d="M12 21.2s-7.6-4.7-9.6-9.4C.9 8.3 3 4.4 6.9 4.4c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 3.9 4.5 7.4-2 4.7-9.6 9.4-9.6 9.4z" fill="#C9D4E1" />,
  nut: () => (
    <>
      <path d="M12 2.6c4.3 2.8 7 6.6 7 10.6a7 7 0 0 1-14 0c0-4 2.7-7.8 7-10.6z" fill="#A3642B" />
      <path d="M12 4.4c3 2.3 5 5.3 5 8.6a5 5 0 0 1-2.2 4.2" fill="none" stroke="#D99A55" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2.6c1.3.9 2.4 1.8 3.3 2.9-1.1.5-2.2.7-3.3.7s-2.2-.2-3.3-.7c.9-1.1 2-2 3.3-2.9z" fill="#6E3F16" />
    </>
  ),
  lock: () => (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="3" fill="currentColor" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="2.6" />
    </>
  ),
  check: () => <path d="M4.5 12.5l4.8 4.8L19.5 7" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />,
  close: () => <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />,
  speaker: () => (
    <>
      <path d="M3.5 9.2h3.6L12 5v14l-4.9-4.2H3.5z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.4" />
      <path d="M15.2 9a4.2 4.2 0 0 1 0 6M17.8 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  'speaker-off': () => (
    <>
      <path d="M3.5 9.2h3.6L12 5v14l-4.9-4.2H3.5z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.4" />
      <path d="M15.6 9.4l5 5.2M20.6 9.4l-5 5.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  turtle: () => (
    <>
      <path d="M4 15.5c0-4 3.4-7.3 7.5-7.3s7.5 3.3 7.5 7.3z" fill="currentColor" />
      <circle cx="20.3" cy="13.3" r="2" fill="currentColor" />
      <path d="M6.5 15.5l-1 2.6M16.5 15.5l1 2.6M11.5 8.2v7.3M7.5 10.5l8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 11.3l3.5-2.2 3.5 2.2v3.2H8z" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.3" />
    </>
  ),
  mic: () => (
    <>
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  play: () => <path d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10.2-6.8a1 1 0 0 0 0-1.6L9.6 4.4c-.7-.5-1.6 0-1.6.8z" fill="currentColor" />,
  pause: () => (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    </>
  ),
  stop: () => <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />,
  learn: () => (
    <>
      <path d="M2.5 20.5L9 9.5l3.6 5.6 2.4-3.3 6.5 8.7z" fill="#139FE0" />
      <path d="M9 9.5l2.2 3.4-1.1 1-1.1-1.2-1.3 1.3-.9-.9z" fill="#fff" />
      <circle cx="17.5" cy="6" r="3" fill="#F8B818" />
    </>
  ),
  kai: () => (
    <>
      <path d="M13.8 3.2l3.4-1 .8 2.4-3.3 1.2z" fill="#6E3F16" />
      <path d="M14.6 5L9.4 14" stroke="#A3642B" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="7.6" cy="16.6" rx="5" ry="5.6" transform="rotate(30 7.6 16.6)" fill="#F8B818" />
      <circle cx="8.2" cy="16.2" r="1.7" fill="#6E3F16" />
      <path d="M15.6 4.4L8.4 17M16.6 5L9.4 17.6" stroke="#fff" strokeWidth=".7" />
    </>
  ),
  voices: () => (
    <>
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="#139FE0" />
      <path d="M10.4 6h3.2M10.4 9h3.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="#0A3A6E" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  league: () => (
    <>
      <path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.4-8 9.8-4.6-1.4-8-5-8-9.8V5.5z" fill="#F8B818" />
      <path d="M12 4.6l6 2.3v4.8c0 3.7-2.5 6.5-6 7.7z" fill="#FFD25A" />
      <path d="M12 8v6M9.2 9.4c0-1.4 1.3-2 2.8-.6 1.5-1.4 2.8-.8 2.8.6" fill="none" stroke="#9A6B00" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  quests: () => (
    <>
      <rect x="3" y="9" width="18" height="11.5" rx="2.2" fill="#C4782F" />
      <path d="M3 11.5A6.5 5 0 0 1 9.5 6.5h5A6.5 5 0 0 1 21 11.5V13H3z" fill="#E59A45" />
      <rect x="10" y="11" width="4" height="5" rx="1" fill="#F8B818" />
      <path d="M3 13h18" stroke="#8A4E1A" strokeWidth="1.4" />
    </>
  ),
  shop: () => (
    <>
      <path d="M5 8h14l-1.2 12.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z" fill="#EF6461" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" stroke="#0A3A6E" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13.5h8" stroke="#FFB3B1" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  profile: () => (
    <>
      <circle cx="12" cy="12" r="10" fill="#8B5CF6" />
      <circle cx="12" cy="9.6" r="3.4" fill="#fff" />
      <path d="M5.8 18.2c1.4-2.3 3.6-3.6 6.2-3.6s4.8 1.3 6.2 3.6" fill="#fff" />
    </>
  ),
  more: () => (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="#139FE0" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="#38B868" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="#F8B818" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="#EF6461" />
    </>
  ),
  book: () => (
    <>
      <path d="M3 5.5c3-1.4 6-1.2 9 .6v14c-3-1.8-6-2-9-.6z" fill="#38B868" />
      <path d="M21 5.5c-3-1.4-6-1.2-9 .6v14c3-1.8 6-2 9-.6z" fill="#2A9653" />
      <path d="M5.5 9c1.6-.4 3.1-.2 4.5.5M5.5 12c1.6-.4 3.1-.2 4.5.5" stroke="#B9EDCB" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  abc: () => (
    <>
      <rect x="2.5" y="3" width="19" height="18" rx="4" fill="#0A3A6E" />
      <text x="12" y="17" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="Nunito Variable, Nunito, sans-serif">
        Ӧ
      </text>
    </>
  ),
  school: () => (
    <>
      <path d="M12 3L2 8l10 5 10-5z" fill="#0A3A6E" />
      <path d="M6 10.3v5.2c0 1.6 2.7 3.2 6 3.2s6-1.6 6-3.2v-5.2l-6 3z" fill="#139FE0" />
      <path d="M20.5 8.8V15" stroke="#F8B818" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20.5" cy="16" r="1.4" fill="#F8B818" />
    </>
  ),
  travel: () => (
    <>
      <circle cx="12" cy="12" r="10" fill="#38B868" />
      <path d="M14.8 9.2l-1.7 4.6-4.6 1.7 1.7-4.6z" fill="#fff" />
      <circle cx="12" cy="12.4" r="1" fill="#2A9653" />
    </>
  ),
  settings: () => (
    <path
      d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm8.5 4.6l-1.9.4a6.8 6.8 0 0 1-.8 1.9l1.1 1.6-1.6 1.6-1.6-1.1a6.8 6.8 0 0 1-1.9.8l-.4 1.9h-2.3l-.4-1.9a6.8 6.8 0 0 1-1.9-.8l-1.6 1.1-1.6-1.6 1.1-1.6a6.8 6.8 0 0 1-.8-1.9l-1.9-.4v-2.3l1.9-.4c.2-.7.5-1.3.8-1.9L5.6 6.9l1.6-1.6 1.6 1.1c.6-.3 1.2-.6 1.9-.8l.4-1.9h2.3l.4 1.9c.7.2 1.3.5 1.9.8l1.6-1.1 1.6 1.6-1.1 1.6c.3.6.6 1.2.8 1.9l1.9.4z"
      fill="currentColor"
      fillRule="evenodd"
    />
  ),
  info: () => (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 11v6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.5" fill="#fff" />
    </>
  ),
  chest: () => (
    <>
      <rect x="2.5" y="10" width="19" height="11" rx="2.2" fill="#C4782F" />
      <path d="M2.5 12A7 5.6 0 0 1 9.5 6h5a7 5.6 0 0 1 7 6v1.5h-19z" fill="#E59A45" />
      <rect x="9.8" y="11.5" width="4.4" height="5.5" rx="1.2" fill="#F8B818" />
      <path d="M2.5 13.5h19M7 6.6V21M17 6.6V21" stroke="#8A4E1A" strokeWidth="1.3" />
    </>
  ),
  'chest-open': () => (
    <>
      <rect x="2.5" y="11" width="19" height="10" rx="2.2" fill="#C4782F" />
      <path d="M4 10.5L6.5 3h11L20 10.5z" fill="#8A4E1A" />
      <path d="M6 10.6l1.8-5.6h8.4l1.8 5.6z" fill="#F8B818" />
      <circle cx="9.5" cy="8.5" r="1.5" fill="#FFE27A" />
      <circle cx="14" cy="7.6" r="1.2" fill="#FFE27A" />
      <rect x="9.8" y="12.5" width="4.4" height="5" rx="1.2" fill="#F8B818" />
    </>
  ),
  trophy: () => (
    <>
      <path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#F8B818" />
      <path d="M7 5H3.5v1.5A3.5 3.5 0 0 0 7 10M17 5h3.5v1.5A3.5 3.5 0 0 1 17 10" fill="none" stroke="#D49A06" strokeWidth="1.8" />
      <path d="M10.5 13h3v4h-3z" fill="#D49A06" />
      <rect x="7" y="17" width="10" height="4" rx="1.2" fill="#0A3A6E" />
    </>
  ),
  star: () => <path d="M12 2.6l2.8 5.8 6.4.8-4.7 4.4 1.2 6.3L12 16.8l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="currentColor" />,
  bolt: () => <path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" fill="#F8B818" stroke="#D49A06" strokeWidth="1.2" strokeLinejoin="round" />,
  target: () => (
    <>
      <circle cx="12" cy="12" r="9.5" fill="#EF6461" />
      <circle cx="12" cy="12" r="6.5" fill="#fff" />
      <circle cx="12" cy="12" r="3.5" fill="#EF6461" />
    </>
  ),
  gem: () => (
    <>
      <path d="M6 3.5h12l3.5 5.5L12 21 2.5 9z" fill="#139FE0" />
      <path d="M2.5 9h19M8.5 3.5L7 9l5 12 5-12-1.5-5.5" fill="none" stroke="#8FD6F7" strokeWidth="1.2" />
    </>
  ),
  freeze: () => (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#9FD3F5" />
      <path d="M12 6v12M6.8 9l10.4 6M17.2 9L6.8 15" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 6.5c1-1 2-1.4 3.2-1.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  clock: () => (
    <>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  'arrow-left': () => <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />,
  'arrow-right': () => <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-right': () => <path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-down': () => <path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  refresh: () => (
    <path d="M19 12a7 7 0 1 1-2.1-5M19 4v4.5h-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  trash: () => (
    <path d="M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  download: () => <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  search: () => (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  plus: () => <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />,
  edit: () => (
    <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM14 6.5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
  ),
  qr: () => (
    <>
      <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 6h2v2H6zM16 6h2v2h-2zM6 16h2v2H6zM13.5 13.5h3v3h-3zM17.5 17.5h3v3h-3zM17.5 13.5h3v2h-3zM13.5 17.5h2v3h-2z" fill="currentColor" />
    </>
  ),
  copy: () => (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  map: () => (
    <>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" fill="#9FD3F5" />
      <path d="M9 4v13.5M15 6.5V20" stroke="#139FE0" strokeWidth="1.6" />
      <path d="M4.5 14c2-1 3.5-.5 5 .5s3.5 2 6 .5 3-1.5 4-1" fill="none" stroke="#38B868" strokeWidth="1.6" />
    </>
  ),
  music: () => (
    <>
      <path d="M9 18V5.5l11-2V16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.8" fill="currentColor" />
      <circle cx="17.5" cy="16" r="2.8" fill="currentColor" />
    </>
  ),
  'music-off': () => (
    <>
      <path d="M9 18V5.5l11-2V16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity=".5" />
      <circle cx="6.5" cy="18" r="2.8" fill="currentColor" opacity=".5" />
      <circle cx="17.5" cy="16" r="2.8" fill="currentColor" opacity=".5" />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  calendar: () => (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  users: () => (
    <>
      <circle cx="9" cy="8.5" r="3.5" fill="currentColor" />
      <path d="M2.5 19.5c.7-3.3 3.4-5.3 6.5-5.3s5.8 2 6.5 5.3z" fill="currentColor" />
      <circle cx="17" cy="9.5" r="2.7" fill="currentColor" opacity=".6" />
      <path d="M16.5 14.5c2.6 0 4.5 1.8 5 4.5h-4.3" fill="currentColor" opacity=".6" />
    </>
  ),
  pin: () => (
    <>
      <path d="M12 22s-7-6.6-7-12a7 7 0 0 1 14 0c0 5.4-7 12-7 12z" fill="currentColor" />
      <circle cx="12" cy="10" r="2.6" fill="#fff" />
    </>
  ),
  sparkles: () => (
    <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9zM5 15l.7 1.6 1.6.7-1.6.7L5 19.6l-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" />
  ),
  dumbbell: () => (
    <>
      <rect x="2" y="9" width="3" height="6" rx="1" fill="currentColor" />
      <rect x="5" y="6.5" width="3.2" height="11" rx="1.2" fill="currentColor" />
      <rect x="15.8" y="6.5" width="3.2" height="11" rx="1.2" fill="currentColor" />
      <rect x="19" y="9" width="3" height="6" rx="1" fill="currentColor" />
      <rect x="8" y="10.8" width="8" height="2.4" fill="currentColor" />
    </>
  ),
  keyboard: () => (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 10h1.5M9.5 10H11M13 10h1.5M16.5 10H18M7 14h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

export function Icon({ name, size = 24, className, style, title }: Props) {
  const Body = P[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <Body />
    </svg>
  );
}
