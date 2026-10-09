// Шапка прячется при прокрутке вниз и возвращается при прокрутке вверх (класс is-hidden, движение — в CSS шапки).
// Выше from() шапка видна всегда. Мелкое дрожание колеса и тачпада (до 6 px) ничего не меняет.
// Если по ссылкам шапки ходят с клавиатуры, она не прячется.
const NUDGE = 6;

export function autoHide(bar: HTMLElement, from: () => number) {
  let lastY = scrollY;
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'));
  return (y: number) => {
    const start = from();
    const dy = y - lastY;
    if (y < start) bar.classList.remove('is-hidden');
    else if (dy > NUDGE && !bar.querySelector(':focus-visible')) bar.classList.add('is-hidden');
    else if (dy < -NUDGE) bar.classList.remove('is-hidden');
    if (Math.abs(dy) > NUDGE || y < start) lastY = y;
  };
}
