import { useEffect } from 'react';
import { useRoute, navigate } from './lib/router';
import { useStore, setState } from './state/store';
import { settleLeague, ensureQuests } from './state/game';
import { Layout } from './layout/Layout';
import { serverOn } from './net/client';
import { onSpeechIssue } from './audio/voice';
import { Toasts, toast } from './ui/kit';
import Learn from './pages/Learn';
import LessonPage from './pages/Lesson';
import { EpicPage, EpicPlayer } from './pages/Epic';
import Voices from './pages/Voices';
import League from './pages/League';
import Quests from './pages/Quests';
import Shop from './pages/Shop';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Dictionary from './pages/Dictionary';
import Alphabet from './pages/Alphabet';
import ClassMode from './pages/ClassMode';
import Travel from './pages/Travel';
import About from './pages/About';
import Onboarding from './pages/Onboarding';
import { SignupModal } from './pages/Signup';

type HostWin = Window & { __hostTheme?: string | null };

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    const w = window as HostWin;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    let mine: string | null = null;
    const apply = () => {
      // «Как в системе» следует теме просмотрщика, если он её задал
      const host = w.__hostTheme;
      const dark = theme === 'dark' || (theme === 'system' && (host === 'dark' || host === 'light' ? host === 'dark' : mq.matches));
      mine = dark ? 'dark' : 'light';
      if (root.getAttribute('data-theme') !== mine) root.setAttribute('data-theme', mine);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1a2e' : '#139FE0');
    };
    const obs = new MutationObserver(() => {
      const v = root.getAttribute('data-theme');
      if (v !== mine) {
        w.__hostTheme = v;
        apply();
      }
    });
    apply();
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    mq.addEventListener?.('change', apply);
    return () => {
      obs.disconnect();
      mq.removeEventListener?.('change', apply);
    };
  }, [theme]);
}

export default function App() {
  useTheme();
  const { main, rest, path } = useRoute();
  const onboarded = useStore((s) => s.settings.onboarded);

  useEffect(() => {
    // с сервером итоги недели подводятся по настоящей группе — после входа
    if (!serverOn) settleLeague();
    setState((d) => ensureQuests(d));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  useEffect(
    () =>
      onSpeechIssue(() =>
        toast('Не слышно слов?', {
          icon: '🔇',
          sub: 'Проверьте громкость. На Android нужен синтез речи Google: Настройки → Спец. возможности → Синтез речи. Аудиозадания можно пропустить кнопкой «Не могу слушать».',
          ms: 9000,
        }),
      ),
    [],
  );

  useEffect(() => {
    // ссылка из письма устарела или уже использована — Supabase вернул ошибку в адресе
    if (/error_description=/.test(window.location.hash)) {
      toast('Ссылка из письма не сработала', { icon: '⚠️', sub: 'Скорее всего, она устарела или уже открыта. Отправьте письмо ещё раз.' });
      navigate('learn', true);
    }
  }, []);

  useEffect(() => {
    // QR-код из режима «Класс»: #/join/КОД
    if (main === 'join' && rest[0]) {
      try {
        sessionStorage.setItem('tadar.join', rest[0]);
      } catch {
        /* noop */
      }
      navigate('class', true);
    }
  }, [main, rest]);

  let page: React.ReactNode;
  let full = false;
  if (!onboarded && main === 'about') {
    page = <About />;
    full = true;
  } else if (!onboarded) {
    page = <Onboarding />;
    full = true;
  } else if (main === 'lesson') {
    page = <LessonPage key={path} />;
    full = true;
  } else if (main === 'practice') {
    page = <LessonPage key={path} practice />;
    full = true;
  } else if (main === 'epic' && rest[0]) {
    page = <EpicPlayer key={rest[0]} id={rest[0]} />;
    full = true;
  } else if (main === 'welcome') {
    page = <Onboarding />;
    full = true;
  } else {
    const map: Record<string, React.ReactNode> = {
      learn: <Learn />,
      epic: <EpicPage />,
      voices: <Voices />,
      league: <League />,
      quests: <Quests />,
      shop: <Shop />,
      profile: <Profile />,
      settings: <Settings />,
      dictionary: <Dictionary />,
      alphabet: <Alphabet />,
      class: <ClassMode />,
      travel: <Travel place={rest[0] === 'place' ? rest[1] : undefined} />,
      about: <About />,
    };
    page = map[main] ?? <Learn />;
  }

  return (
    <>
      {full ? page : <Layout rail={main !== 'travel' && main !== 'class'}>{page}</Layout>}
      <Toasts />
      <SignupModal />
    </>
  );
}
