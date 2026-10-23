// Тема «Терминал»: html[data-theme="term"] + выбор в localStorage. До отрисовки тему ставит inline-скрипт в Base.astro,
// здесь — только кнопки. Событие themechange нужно тем, кто красит canvas по токенам (змейка).
const KEY = 'bat-theme';
const root = document.documentElement;
const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function sync() {
  const on = root.dataset.theme === 'term';
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
  meta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#ffffff');
}

function set(on: boolean) {
  if (on) root.dataset.theme = 'term'; else delete root.dataset.theme;
  try { localStorage.setItem(KEY, on ? 'term' : ''); } catch { /* хранилище недоступно — тема до перезагрузки */ }
  // включение — короткая вспышка, как у монитора при включении
  if (on && !reduced.matches) {
    root.classList.remove('term-boot');
    void root.offsetWidth;
    root.classList.add('term-boot');
    setTimeout(() => root.classList.remove('term-boot'), 500);
  }
  sync();
  dispatchEvent(new Event('themechange'));
}

document.addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest('[data-theme-toggle]')) set(root.dataset.theme !== 'term');
});
sync();
