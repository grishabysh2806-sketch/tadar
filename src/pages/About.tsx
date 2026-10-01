import { Mascot } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { Mountains } from '../ui/Ornament';
import { navigate } from '../lib/router';
import { useStore } from '../state/store';
import { MASCOT_NAME } from '../ui/kit';

const ROADMAP = [
  { when: 'Окт–дек 2026', what: 'MVP: первые разделы и демоверсия', now: true },
  { when: 'Янв–мар 2027', what: 'Пилот в школах и с КемГУ, сбор «Голосов старших»' },
  { when: 'Апр–июн 2027', what: 'Версии для Android и iOS, режим «Класс» для учителей' },
  { when: 'Июл–ноя 2027', what: 'Режим «Путешественник» к зимнему сезону в Шерегеше' },
  { when: '2028', what: 'Более 100 уроков, проверка произношения, телеутский язык' },
];

const TEAM = [
  { name: 'Бушуев Григорий', role: 'Руководитель проекта', text: 'Стратегия, партнёры, разработка, архитектура' },
  { name: 'Слободянюк Роман', role: 'Контент и методика', text: 'Уроки, работа с носителями языка' },
  { name: 'Омаров Виталий', role: 'Дизайн и видео', text: 'Маскот, интерфейс, ролики' },
  { name: 'Ткачук Иван', role: 'Разработка', text: 'Прототип и приложение' },
  { name: 'Гребеньков Кирилл', role: 'Экономика и продвижение', text: 'Финансы, гранты, соцсети' },
];

export default function About() {
  const onboarded = useStore((s) => s.settings.onboarded);
  return (
    <div className="about">
      <section className="about-hero">
        <div className="ah-bg" />
        <Mountains className="ah-mountains" />
        <div className="ah-content">
          <button className="icon-btn light" onClick={() => navigate(onboarded ? 'learn' : 'welcome')} aria-label="Назад">
            <Icon name="arrow-left" size={26} />
          </button>
          <h1>Тадар</h1>
          <p className="ah-lead">Первый способ выучить шорский язык играючи — с живыми голосами носителей и эпосом кай.</p>
          <p className="ah-quote">Чтобы шорский язык звучал в каждом телефоне!</p>
        </div>
      </section>

      <div className="about-body">
        <section className="about-sec">
          <h2>Почему «Тадар»</h2>
          <p>
            Тадар — самоназвание шорцев, коренного тюркского народа юга Кузбасса. Название отражает концепцию: язык живёт, пока на нём говорят люди.
          </p>
          <div className="facts">
            <div>
              <b>12,9 тыс.</b>
              <span>шорцев по переписи 2010 года</span>
            </div>
            <div>
              <b>≈ 2,8 тыс.</b>
              <span>человек говорят по-шорски</span>
            </div>
            <div>
              <b>в 2 раза</b>
              <span>меньше говорящих, чем в 2002 году</span>
            </div>
          </div>
          <p className="muted small-note">Источники: Большая российская энциклопедия; Всероссийская перепись населения 2002 г.; Институт языкознания РАН, проект «Малые языки России».</p>
        </section>

        <section className="about-sec">
          <h2>Что внутри</h2>
          <div className="pillars">
            <div>
              <Icon name="learn" size={36} />
              <b>Уроки по 5 минут</b>
              <span>Перевод, пары слов, сборка фраз, аудирование. Опыт, серии дней и лиги — как в любимой игре.</span>
            </div>
            <div>
              <Icon name="voices" size={36} />
              <b>Голоса старших</b>
              <span>Ученики записывают слова у бабушек и дедушек — так растёт открытый аудиословарь.</span>
            </div>
            <div>
              <Icon name="kai" size={36} />
              <b>Эпос кай как награда</b>
              <span>За каждый раздел открывается фрагмент героического сказания с музыкальным сопровождением.</span>
            </div>
            <div>
              <Icon name="school" size={36} />
              <b>«Класс» и «Путешественник»</b>
              <span>Задания и прогресс для учителей, мини-курс и карта Горной Шории для туристов.</span>
            </div>
          </div>
        </section>

        <section className="about-sec">
          <h2>Дорожная карта</h2>
          <ol className="roadmap">
            {ROADMAP.map((r, i) => (
              <li key={r.when} className={r.now ? 'now' : ''}>
                <span className="rm-n">{i + 1}</span>
                <div>
                  <b>{r.when}</b>
                  <span>{r.what}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="about-sec">
          <h2>Команда</h2>
          <p className="muted">СПбПУ, Санкт-Петербург. Эксперты — носители и преподаватели шорского языка.</p>
          <div className="team">
            {TEAM.map((t) => (
              <div key={t.name} className="team-card">
                <b>{t.name}</b>
                <span className="pill blue">{t.role}</span>
                <small>{t.text}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="about-sec">
          <h2>Источники и благодарности</h2>
          <ul className="sources">
            <li>Лексика — русско-шорский и шорско-русский словари проекта «Тадар тили» (tili.tadarlar.ru), шорские статьи Викисловаря. Каждый урок перед выпуском проверяют носитель и преподаватель.</li>
            <li>Приветствия и диалоги — учебные материалы «Тадар тили»; «Русско-шорский разговорник» (М. П. Амзоров, И. В. Шенцова, НГПИ, 1991).</li>
            <li>Сюжеты эпоса — «Шорский героический эпос», т. 1 (сост. Д. А. Функ, 2010), записи В. В. Радлова и Н. П. Дыренковой, репертуар кайчи В. Е. Таннагашева. В приложении — краткие пересказы, а не переводы.</li>
            <li>Алфавит — современная шорская письменность (Э. Ф. Чиспияков, 1988–1989).</li>
            <li>
              Озвучка — пока синтез речи браузера и синтез музыки кая. Записи носителей и исполнителей эпоса появятся в пилоте; первые — уже сейчас через «Голоса старших».
            </li>
          </ul>
        </section>

        <section className="about-sec about-mascot">
          <Mascot pose="hero" size={160} anim="bob" />
          <p>
            Маскот — волчонок {MASCOT_NAME} (по-шорски «волк»), украшенный шорским орнаментом. Он ведёт по урокам и радуется каждому вашему слову.
          </p>
        </section>

        <div className="center" style={{ padding: '10px 0 40px' }}>
          <button className="btn lg" onClick={() => navigate(onboarded ? 'learn' : 'welcome')}>
            {onboarded ? 'К урокам' : 'Начать учить'}
          </button>
        </div>
      </div>
    </div>
  );
}
