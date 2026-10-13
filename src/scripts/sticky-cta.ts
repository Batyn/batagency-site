// Липкая «Оставить заявку»: на всех страницах видна сразу, с первого экрана (Batın 2026-10-13).
// Правило (Batın 2026-10-14): липкая и кнопка отправки брифа на экране одновременно не бывают. Кнопка прячется чуть раньше,
// чем низ брифа (кнопка отправки, плашка сбоя или «Спасибо») показывается снизу, — на высоту самой липкой с отступом,
// чтобы за 200 мс исчезновения они не стояли рядом. Если бриф с кнопкой виден уже при загрузке (короткие страницы), липкой нет.
// На телефоне окно cookies во всю ширину — кнопка ждёт «Принять» (событие cookie-accepted из CookieBanner).
const cta = document.querySelector<HTMLElement>('[data-cta]');
const ends = [...document.querySelectorAll<HTMLElement>('#zayavka .bf-actions, #zayavka .bf-done')];

if (cta && 'IntersectionObserver' in window) {
  const phone = matchMedia('(max-width: 760px)');
  const cookie = document.getElementById('cookie-banner');
  let briefReached = false;

  const sync = () => {
    const cookieOpen = phone.matches && cookie !== null && !cookie.hidden;
    cta.classList.toggle('is-in', !briefReached && !cookieOpen);
  };

  // у скрытого элемента (форма после «Спасибо») прямоугольник нулевой — его не считаем
  const seen = new Map<Element, boolean>();
  if (ends.length) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const shown = e.boundingClientRect.height > 0;
        seen.set(e.target, shown && (e.isIntersecting || e.boundingClientRect.bottom < 0));
      }
      briefReached = [...seen.values()].some(Boolean);
      sync();
    }, { rootMargin: `0px 0px ${cta.offsetHeight + 32}px 0px` });
    ends.forEach((el) => io.observe(el));
  }

  document.addEventListener('cookie-accepted', sync);
  phone.addEventListener('change', sync);
  sync();
} else cta?.classList.add('is-in');
