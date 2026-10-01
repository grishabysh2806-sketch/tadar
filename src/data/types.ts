export type Pos =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'num'
  | 'pron'
  | 'adv'
  | 'phrase'
  | 'interj'
  | 'particle';

/** Слово или устойчивое выражение курса. */
export interface Item {
  id: string;
  /** Написание на шорском (кириллица с буквами ғ қ ң ӧ ӱ). */
  shor: string;
  /** Перевод; варианты значений через «; ». */
  ru: string;
  /** Дополнительные допустимые переводы при вводе с клавиатуры. */
  alt?: string[];
  emoji?: string;
  /** Образец цвета для слов-цветов. */
  swatch?: string;
  /** Числовое значение для числительных. */
  num?: number;
  note?: string;
  pos?: Pos;
  unit?: string;
}

/** Предложение-пример (все — из словарных статей или собраны из проверенных слов). */
export interface Sentence {
  id: string;
  shor: string;
  ru: string;
  ruAlt?: string[];
  /** Подсказка к каждому шорскому слову (по порядку слов). */
  gloss: string[];
  note?: string;
}

export interface Lesson {
  id: string;
  title: string;
  items: string[];
  sentences?: string[];
}

export interface GuideSection {
  title: string;
  text: string;
  examples?: { shor: string; ru: string }[];
}

export interface Unit {
  id: string;
  n: number;
  shorTitle: string;
  title: string;
  subtitle: string;
  color: string;
  colorDark: string;
  /** Тёмный текст на светлом баннере (для золотого). */
  ink?: string;
  icon: string;
  lessons: Lesson[];
  epicId: string;
  guide: GuideSection[];
}

export interface EpicFragment {
  id: string;
  unitId: string;
  title: string;
  source: string;
  performer?: string;
  intro: string;
  lines: string[];
  words: { shor: string; ru: string }[];
  /** Тональность и характер синтеза кая. */
  mood: { root: number; tempo: number; komus: 'gallop' | 'walk' | 'still'; overtone: number[] };
  scene: 'mountain' | 'taiga' | 'horse' | 'sky' | 'fire' | 'river';
}
