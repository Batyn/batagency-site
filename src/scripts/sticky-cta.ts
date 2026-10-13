// Липкая «Оставить заявку»: видна, когда первый экран пройден и бриф ещё впереди.
// На телефоне окно cookies во всю ширину — кнопка ждёт «Принять» (событие cookie-accepted из CookieBanner).
const cta = document.querySelector<HTMLElement>('[data-cta]');
const brief = document.getElementById('zayavka');

if (cta && 'IntersectionObserver' in window) {
  // на главной граница — кнопка «Бесплатная консультация» первого экрана, на остальных — высота экрана
  const start = document.querySelector('[data-cta-hero]') || document.querySelector('[data-cta-start]');
  const phone = matchMedia('(max-width: 760px)');
  const cookie = document.getElementById('cookie-banner');
  let pastStart = false;
  let briefReached = false;

  const sync = () => {
    const cookieOpen = phone.matches && cookie !== null && !cookie.hidden;
    cta.classList.toggle('is-in', pastStart && !briefReached && !cookieOpen);
  };

  if (start) new IntersectionObserver(([e]) => {
    // ушла вверх за экран — значит, первый экран пройден
    pastStart = !e.isIntersecting && e.boundingClientRect.top < 0;
    sync();
  }).observe(start);

  // бриф на экране или уже выше — кнопка не нужна
  if (brief) new IntersectionObserver(([e]) => {
    briefReached = e.isIntersecting || e.boundingClientRect.top < 0;
    sync();
  }).observe(brief);

  document.addEventListener('cookie-accepted', sync);
  phone.addEventListener('change', sync);
} else cta?.classList.add('is-in');
