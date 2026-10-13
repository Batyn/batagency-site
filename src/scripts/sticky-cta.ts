// Липкая «Оставить заявку»: на всех страницах видна сразу, с первого экрана (Batın 2026-10-13).
// Прячется, когда бриф дошёл до верхней четверти экрана: на коротких страницах (404, «О нас») бриф виден
// краем уже при загрузке, и правило «бриф на экране» прятало кнопку совсем (баг 39).
// На телефоне окно cookies во всю ширину — кнопка ждёт «Принять» (событие cookie-accepted из CookieBanner).
const cta = document.querySelector<HTMLElement>('[data-cta]');
const brief = document.getElementById('zayavka');

if (cta && 'IntersectionObserver' in window) {
  const phone = matchMedia('(max-width: 760px)');
  const cookie = document.getElementById('cookie-banner');
  let briefReached = false;

  const sync = () => {
    const cookieOpen = phone.matches && cookie !== null && !cookie.hidden;
    cta.classList.toggle('is-in', !briefReached && !cookieOpen);
  };

  // нижние три четверти экрана не считаются (404 на телефоне: бриф с 40 % высоты): бриф там — ещё не повод прятать кнопку
  if (brief) new IntersectionObserver(([e]) => {
    briefReached = e.isIntersecting || e.boundingClientRect.top < 0;
    sync();
  }, { rootMargin: '0px 0px -75% 0px' }).observe(brief);

  document.addEventListener('cookie-accepted', sync);
  phone.addEventListener('change', sync);
  sync();
} else cta?.classList.add('is-in');
