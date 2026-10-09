// Яндекс Метрика: грузится только после «Принять» (решение Batın 2026-10-09) и только на боевом домене —
// на localhost счётчик не трогаем, чтобы не засорять статистику.
const KEY = 'bat-cookie-consent';
const ID = Number(import.meta.env.PUBLIC_YM_ID);
const LIVE_HOSTS = ['batagency.co'];

declare global {
  interface Window { ym?: (...args: unknown[]) => void }
}

export function hasConsent(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function saveConsent(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* приватный режим: окно появится снова */ }
}

let loaded = false;
export function loadMetrica(): void {
  if (loaded || !ID || !LIVE_HOSTS.includes(location.hostname)) return;
  loaded = true;
  // официальный код счётчика, без <noscript>-пикселя (ТЗ, раздел 13)
  const w = window as any;
  w.ym = w.ym || function () { (w.ym.a = w.ym.a || []).push(arguments); };
  w.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(s);
  w.ym(ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
}
