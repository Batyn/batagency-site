// Премии для страницы «Календарь премий» (/kalendar-premiy/) — единственный список: таймлайн, сводка, телефонный
// календарь и счётчики фильтра берут данные только отсюда. Источник — таблица Batın, сверено на DATA_DATE.
// Обновлять после каждого сезона: даты, «~», взносы, DATA_DATE и дату в сноске (content/site-texts.md, раздел 7).

export type AwardKind = 'ru' | 'intl';

export interface Award {
  name: string;
  /** короткое имя для перечня «Приём идёт сейчас» */
  short: string;
  country: string;
  kind: AwardKind;
  /** последний день подачи, ISO; у круглогодичной премии не задан */
  deadline?: string;
  /** дата ориентировочная, по прошлому сезону — на сайте «~» */
  approx?: boolean;
  /** известен только месяц: на таймлайне отметка по дате, в сетке месяца день не отмечаем */
  monthOnly?: boolean;
  /** взнос в рублях: «от …» или «≈ …»; null — уточняется */
  feeRub: string | null;
  /** взнос в валюте организатора */
  feeCur?: string;
  yearRound?: boolean;
  /** приём был открыт на DATA_DATE (даты открытия у организаторов не везде известны) */
  openOnDataDate?: boolean;
}

/** дата сверки с сайтами организаторов */
export const DATA_DATE = '2026-10-12';

export const AWARDS: Award[] = [
  { name: 'E+ Awards (бывш. Effie Russia)', short: 'E+ Awards', country: 'Россия', kind: 'ru', deadline: '2026-10-30', feeRub: 'от 100 000 ₽', openOnDataDate: true },
  { name: 'Tagline Awards', short: 'Tagline', country: 'Россия', kind: 'ru', deadline: '2026-11-01', feeRub: 'от 28 000 ₽', openOnDataDate: true },
  { name: 'iF Design Award', short: 'iF', country: 'Германия', kind: 'intl', deadline: '2026-11-04', feeRub: '≈ 48 300 ₽', feeCur: '€500', openOnDataDate: true },
  // ранний срок 02.10 не показываем, у премии одна отметка (решение Batın 2026-10-12)
  { name: 'Transform Awards Europe', short: 'Transform Awards Europe', country: 'Великобритания', kind: 'intl', deadline: '2026-11-06', feeRub: '≈ 43 300 ₽', feeCur: 'от £385', openOnDataDate: true },
  { name: 'ОСНОВА', short: 'ОСНОВА', country: 'Россия', kind: 'ru', deadline: '2026-11-11', feeRub: 'от 25 500 ₽', openOnDataDate: true },
  { name: 'D&AD', short: 'D&AD', country: 'Великобритания', kind: 'intl', deadline: '2027-01-14', approx: true, feeRub: '≈ 16 000 ₽', feeCur: 'от £142,10' },
  { name: 'ADC Annual Awards', short: 'ADC', country: 'США', kind: 'intl', deadline: '2027-01-23', approx: true, feeRub: '≈ 16 800 ₽', feeCur: 'от $200' },
  { name: 'ED-Awards', short: 'ED-Awards', country: 'Европа', kind: 'intl', deadline: '2027-02-13', approx: true, feeRub: '≈ 16 300 ₽', feeCur: '€169' },
  { name: 'Red Dot: Brands & Communication Design', short: 'Red Dot', country: 'Германия', kind: 'intl', deadline: '2027-02-13', approx: true, feeRub: '≈ 24 100 ₽', feeCur: 'от €250' },
  // последнего дня нет, только «ранние окна» в феврале — ориентир «~ февраль 2027» (решение Batın 2026-10-12);
  // дата — середина месяца, чтобы в списке стоять после февральских сроков, как в макете
  { name: 'Белый Квадрат', short: 'Белый Квадрат', country: 'Беларусь', kind: 'intl', deadline: '2027-02-15', approx: true, monthOnly: true, feeRub: '≈ 30 900 ₽', feeCur: '€320 + НДС' },
  { name: 'Silver Mercury', short: 'Silver Mercury', country: 'Россия', kind: 'ru', deadline: '2027-04-23', feeRub: null, openOnDataDate: true },
  { name: 'ADCR Awards', short: 'ADCR', country: 'Россия', kind: 'ru', deadline: '2027-05-15', approx: true, feeRub: 'от 34 000 ₽' },
  { name: 'Red Apple', short: 'Red Apple', country: 'Россия', kind: 'ru', deadline: '2027-05-29', approx: true, feeRub: 'от 55 000 ₽' },
  { name: 'Ad Black Sea', short: 'Ad Black Sea', country: 'Грузия', kind: 'intl', deadline: '2027-06-30', approx: true, feeRub: '≈ 24 100 ₽', feeCur: 'от €250' },
  { name: 'G8 Creative Awards', short: 'G8', country: 'Россия', kind: 'ru', deadline: '2027-07-31', approx: true, feeRub: '30 000 ₽' },
  { name: 'ADCE Awards', short: 'ADCE', country: 'Европа', kind: 'intl', deadline: '2027-09-25', approx: true, feeRub: '≈ 24 100 ₽', feeCur: '€250' },
  { name: 'Awwwards', short: 'Awwwards', country: 'Международная, онлайн', kind: 'intl', yearRound: true, feeRub: '≈ 5 500 ₽', feeCur: '$65', openOnDataDate: true },
  { name: 'СРЕДА', short: 'СРЕДА', country: 'Россия', kind: 'ru', deadline: '2026-10-07', feeRub: 'от 19 700 ₽' },
];
