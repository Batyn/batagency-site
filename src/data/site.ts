// Контакты и меню — одно место для всего сайта.
// Почта временная (баг 6 в MEMORY.md): после задачи 33 заменить на hello@batagency.co.
export const TELEGRAM = 'batynrrr';
export const TELEGRAM_URL = `https://t.me/${TELEGRAM}`;
export const EMAIL = 'erbatyn@gmail.com';

export type NavKey = 'uslugi' | 'kak-rabotaem' | 'o-nas' | 'kontakty';

// Бриф в подвале — на каждой странице (Batın 2026-10-13); «Бесплатная консультация» (#kontakty) — только на главной
export const BRIEF_HASH = '#zayavka';
export const PERSONAL_DATA_PATH = '/personalnye-dannye/';
export const PRIVACY_PATH = '/privacy/';

// На главной меню прокручивает к блокам, с внутренних страниц ведёт на них же.
// «Контакты»: на главной — к блоку консультации, на остальных страницах — к брифу в подвале (contactsHref)
export const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: 'uslugi', label: 'Услуги', href: '/uslugi/' },
  { key: 'kak-rabotaem', label: 'Как работаем', href: '/#kak-rabotaem' },
  { key: 'o-nas', label: 'О нас', href: '/o-nas/' },
  { key: 'kontakty', label: 'Контакты', href: BRIEF_HASH },
];

export const contactsHref = (isHome: boolean) => (isHome ? '#kontakty' : BRIEF_HASH);

export const FOOTER_NAV = [
  { label: 'Главная', href: '/' },
  { label: 'Услуги', href: '/uslugi/' },
  { label: 'Как работаем', href: '/#kak-rabotaem' },
  { label: 'О нас', href: '/o-nas/' },
  { label: 'Контакты', href: BRIEF_HASH },
  { label: 'Вопросы', href: '/#voprosy' },
  { label: 'Календарь премий', href: '/kalendar-premiy/' },
];
