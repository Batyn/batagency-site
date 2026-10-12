// «Календарь премий» в браузере: пересчёт от даты посетителя, фильтр, переключатель «Список / Месяц / Весь год».
// Без JS страница уже целиком в HTML (сводка и таймлайн на день сборки, на телефоне — список).
// Проверка другой даты: ?today=2026-12-01
import {
  dayNum, todayNum, monthRange, monthAnnounce,
  renderSummary, renderTimeline, renderList, renderMonth, renderYear, type Filter,
} from './awards-view';

type Mode = 'list' | 'month' | 'year';

const root = document.querySelector<HTMLElement>('[data-aw]');
if (root) init(root);

function init(root: HTMLElement) {
  const q = new URLSearchParams(location.search).get('today');
  const today = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? dayNum(q) : todayNum();
  const [min, max] = monthRange(today);

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const views = { list: $('[data-view="list"]'), month: $('[data-view="month"]'), year: $('[data-view="year"]') };
  const live = $('[data-live]');
  const tl = $('[data-tl]');

  let filter: Filter = 'all';
  let mode: Mode = 'list';
  let mi = min;

  // HTML собран в день сборки: перерисовываем от сегодняшней даты
  if (String(today) !== root.dataset.built) {
    $('[data-sum]').innerHTML = renderSummary(today);
    tl.innerHTML = renderTimeline(today);
    $('[data-list]').innerHTML = renderList(today);
  }

  const applyFilter = () => {
    root.querySelectorAll<HTMLElement>('[data-kind]').forEach((el) => { el.hidden = filter !== 'all' && el.dataset.kind !== filter; });
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    fitLabels();
  };

  const show = (next: Mode, announce = true) => {
    mode = next;
    if (mode === 'month') views.month.innerHTML = renderMonth(today, mi);
    if (mode === 'year' && !views.year.innerHTML) views.year.innerHTML = renderYear(today);
    (Object.keys(views) as Mode[]).forEach((k) => { views[k].hidden = k !== mode; });
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (announce) live.textContent = mode === 'list' ? 'Список премий' : mode === 'year' ? 'Весь год по месяцам' : monthAnnounce(today, mi);
  };

  root.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-filter], [data-mode], [data-step], [data-mi]');
    if (!t) return;
    if (t.dataset.filter) { filter = t.dataset.filter as Filter; applyFilter(); }
    else if (t.dataset.mode) show(t.dataset.mode as Mode);
    else if (t.dataset.step) {
      mi = Math.min(max, Math.max(min, mi + Number(t.dataset.step)));
      show('month');
      // стрелка могла стать неактивной — фокус оставляем на месте
      const same = $<HTMLButtonElement>(`[data-step="${t.dataset.step}"]`);
      (same.disabled ? $<HTMLButtonElement>(`[data-step="${-Number(t.dataset.step)}"]`) : same).focus();
    } else if (t.dataset.mi) {
      mi = Number(t.dataset.mi);
      show('month');
      $<HTMLElement>('.mo-title').setAttribute('tabindex', '-1');
      $<HTMLElement>('.mo-title').focus();
    }
  });

  // Подпись у отметки не должна заходить в колонку взноса: тогда ставим её слева от отметки
  function fitLabels() {
    if (!tl.offsetParent) return;
    tl.querySelectorAll<HTMLElement>('.tl-lbl:not(.is-passed)').forEach((l) => {
      const right = l.parentElement!.getBoundingClientRect().right;
      l.classList.remove('is-flip');
      if (l.getBoundingClientRect().right > right) l.classList.add('is-flip');
    });
  }
  let raf = 0;
  addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitLabels); });

  root.classList.add('is-ready');
  show('list', false);
  applyFilter();
}
