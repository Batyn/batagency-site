// Плавное раскрытие строк <details> в аккордеонах [data-accordion] (строки услуг на /uslugi/, частые вопросы на главной):
// высота и прозрачность тела, 300 мс (как в прототипе Figma). Значение data-accordion — цель Метрики при раскрытии.
// Высоту анимируем через WAAPI — для аккордеона это допустимое исключение из «только transform и opacity».
// Приход по /uslugi/#якорь раскрывает нужную услугу и прокручивает к ней.
import { goal } from './goals';

const DUR = 300;
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const rows = [...document.querySelectorAll<HTMLDetailsElement>('[data-accordion] details')];
const running = new WeakMap<HTMLDetailsElement, Animation>();

function animate(d: HTMLDetailsElement, opening: boolean) {
  const sum = d.querySelector('summary')!;
  const body = d.querySelector<HTMLElement>('.acc-body')!;
  running.get(d)?.cancel();
  const from = d.offsetHeight;
  if (opening) { d.open = true; goal(d.closest<HTMLElement>('[data-accordion]')!.dataset.accordion!); }
  const to = opening ? d.scrollHeight : sum.offsetHeight + 2;   // + рамка
  if (reduced.matches) { if (!opening) d.open = false; return; }
  d.classList.toggle('is-closing', !opening);
  const a = d.animate({ height: [`${from}px`, `${to}px`] }, { duration: DUR, easing: EASE });
  body.animate({ opacity: opening ? [0, 1] : [1, 0] }, { duration: opening ? DUR : DUR * 0.6, easing: EASE, fill: 'forwards' });
  running.set(d, a);
  a.onfinish = () => {
    if (!opening) d.open = false;
    d.classList.remove('is-closing');
    body.getAnimations().forEach((x) => x.cancel());
    running.delete(d);
  };
}

rows.forEach((d) => {
  d.querySelector('summary')!.addEventListener('click', (e) => {
    e.preventDefault();
    const closing = d.open && !d.classList.contains('is-closing');
    animate(d, !closing);
  });
});

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  // у строк вопросов нет id: пустой якорь не должен совпасть с ними
  const d = id ? rows.find((r) => r.id === id) : undefined;
  if (!d) return;
  d.open = true;
  requestAnimationFrame(() => d.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' }));
}
openFromHash();
addEventListener('hashchange', openFromHash);
