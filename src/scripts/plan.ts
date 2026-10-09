// Календарь «План на полгода». Перенесён из prototypes/plan-timeline.html: 14 услуг из services.ts, шрифт и радиусы — Final.
// Решения Batın: открывается с примером; «Очистить» очищает полностью и пример не возвращает; на плашке — название услуги
// (у примера — подписи из макета); плашки примера покачиваются при наведении до первого действия; на телефоне — вариант C1.
import { SERVICES as ALL } from '../data/services';
import { EMAIL, TELEGRAM } from '../data/site';
import { goal } from './goals';

type Bar = { id: number; start: number; len: number; label: string };
type Row = { s: string; bars: Bar[] };
type Drag = {
  kind: 'chip' | 'bar'; el: HTMLElement; id: number; x0: number; y0: number; x: number; y: number;
  touch: boolean; live: boolean; timer?: number; s?: string; barId?: number; edge?: string | null;
  float?: HTMLElement; target?: number | null; r?: Row; b?: Bar; orig?: { start: number; len: number };
  cand?: { start: number; len: number }; off?: { x: number; y: number }; lift?: HTMLElement; bin?: boolean;
};

const SERVICES = ALL.map((s) => s.title);
// Пример с макета: [месяц начала 0–5, длина в месяцах, подпись]
const EXAMPLE: [string, [number, number, string][]][] = [
  ['Кейсы', [[0, 6, 'кейс каждый месяц']]],
  ['Сайт', [[0, 1, 'страница услуги'], [1, 1, 'новая страница']]],
  ['Премии', [[0, 1, '2 заявки'], [2, 1, '2 заявки'], [3, 1, '4 заявки'], [4, 1, '2 заявки']]],
  ['Статьи', [[1, 1, 'статья'], [3, 1, 'статья'], [5, 1, 'статья']]],
  ['Соцсети', [[0, 1, 'стратегия'], [1, 2, 'посты'], [3, 3, 'посты + реклама']]],
  ['Аудит пути клиента', [[1, 1, 'аудит']]],
  ['Рейтинги и каталоги', [[1, 1, 'Clutch'], [2, 4, 'Рейтинг Рунета']]],
  ['Выступления', [[4, 1, 'подготовка'], [5, 1, 'выступление']]],
];
const MONTHS = 6;
const FOLD = 5;
const HOLD = 280;
const DROP_LABEL = 'Перетащите услугу';
const GRIP = '<svg viewBox="0 0 6.6 12.6" aria-hidden="true"><circle cx="1.3" cy="1.3" r="1.3"/><circle cx="5.3" cy="1.3" r="1.3"/><circle cx="1.3" cy="6.3" r="1.3"/><circle cx="5.3" cy="6.3" r="1.3"/><circle cx="1.3" cy="11.3" r="1.3"/><circle cx="5.3" cy="11.3" r="1.3"/></svg>';

let started = false;
export function initPlan() {
  if (started) return;
  started = true;

  const $ = (id: string) => document.getElementById(id)!;
  const plan = $('plan'), grid = $('pl-grid'), chipsBox = $('pl-chips'), palette = $('pl-palette'), trash = $('pl-trash');
  const CLEAR = grid.dataset.clearIcon || '';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const phone = matchMedia('(max-width: 760px)');

  let uid = 0;
  let rows: Row[] = [];
  let wiggleOn = true;       // гаснет после первого действия
  let touched = false;       // план уже не пример
  let armed: string | null = null;     // услуга, выбранная нажатием: дальше нажимают на месяц
  let selectedId: number | null = null;
  let drag: Drag | null = null;
  let expanded = false;
  let firstAdd = true;
  const fresh = new Set<string | number>();

  const key = (list: [string, (number | string)[][]][]) => JSON.stringify(list.map(([s, bars]) => [s, bars.map((b) => b.slice(0, 3)).sort((a, c) => (a[0] as number) - (c[0] as number))]));
  const EXAMPLE_KEY = key(EXAMPLE);
  const snapshot = () => key(rows.map((r) => [r.s, r.bars.map((b) => [b.start, b.len, b.label])]));
  const fromExample = (): Row[] => EXAMPLE.map(([s, bars]) => ({ s, bars: bars.map(([start, len, label]) => ({ id: ++uid, start, len, label })) }));
  const rowOf = (s: string) => rows.find((r) => r.s === s);
  const rowEl = (s: string) => grid.querySelector<HTMLElement>(`.pl-row[data-s="${CSS.escape(s)}"]`);
  const findBar = (id: number) => { for (const r of rows) { const b = r.bars.find((x) => x.id === id); if (b) return { r, b }; } return null; };
  const free = (r: { bars: Bar[] }, start: number, len: number, skipId?: number) => start >= 0 && len >= 1 && start + len <= MONTHS &&
    r.bars.every((b) => b.id === skipId || start + len <= b.start || b.start + b.len <= start);
  const months = (a: number, l: number) => (l === 1 ? `месяц ${a + 1}` : `месяцы ${a + 1}–${a + l}`);
  // «мес. 1, 3–5»: месяцы услуги текстом, соседние склеиваются
  function monthsText(bars: Bar[]) {
    const ms = [...new Set(bars.flatMap((b) => Array.from({ length: b.len }, (_, k) => b.start + k)))].sort((x, y) => x - y);
    const parts: string[] = []; let s = ms[0], p = ms[0];
    for (let i = 1; i <= ms.length; i++) { if (ms[i] === p + 1) { p = ms[i]; continue; } parts.push(s === p ? `${s + 1}` : `${s + 1}–${p + 1}`); s = ms[i]; p = ms[i]; }
    return 'мес. ' + parts.join(', ');
  }
  const plural = (n: number, one: string, few: string, many: string) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const say = (t: string) => { $('pl-live').textContent = t; };
  function play(el: Element, cls: string) {
    el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls);
    const off = (e: Event) => { if (e.target !== el) return; el.classList.remove(cls); el.removeEventListener('animationend', off); };
    el.addEventListener('animationend', off);
  }
  // ячейки месяцев; на телефоне это кнопки: нажатие добавляет или убирает месяц
  const cells = (r: Row) => Array.from({ length: MONTHS }, (_, m) => {
    const on = r.bars.some((b) => m >= b.start && m < b.start + b.len);
    return `<button type="button" class="pl-cell" data-m="${m}" style="grid-column:${m + 2}" aria-pressed="${on}" aria-label="${esc(r.s)}, месяц ${m + 1}: ${on ? 'убрать' : 'добавить'}"></button>`;
  }).join('');

  chipsBox.innerHTML = SERVICES.map((s) => `<button type="button" class="pl-chip" data-s="${esc(s)}" aria-pressed="false">${GRIP}${esc(s)}</button>`).join('');
  if (!canHover.matches) $('pl-hint').textContent = 'Нажмите на услугу, потом на месяц. Чтобы перетащить услугу или плашку, удерживайте её.';

  /* ---------- отрисовка ---------- */
  function slots(r: { bars: Bar[] }) {
    let out = '';
    for (let m = 0; m < MONTHS; m++) if (free(r, m, 1)) out += `<button type="button" class="pl-slot" data-slot="${m}" style="grid-column:${m + 2}" aria-label="Добавить в месяц ${m + 1}">+</button>`;
    return out;
  }
  function barHtml(r: Row, b: Bar) {
    return `<div class="pl-bar${b.id === selectedId ? ' is-selected' : ''}" tabindex="0" role="button" data-id="${b.id}" style="grid-column:${b.start + 2} / span ${b.len};--amp:${(1.6 / b.len).toFixed(2)}deg" aria-label="${esc(r.s)}: ${esc(b.label)}, ${months(b.start, b.len)}"><span class="h h-l" data-edge="l"></span><span class="t">${esc(b.label)}</span><button class="x" type="button" tabindex="-1" aria-label="Убрать">×</button><span class="h h-r" data-edge="r"></span></div>`;
  }
  grid.innerHTML = `<div class="pl-row pl-headrow"><div class="pl-name"><h3 class="pl-title" data-title></h3><button class="pl-restart" type="button" data-restart aria-label="Очистить календарь" title="Очистить календарь">${CLEAR}</button></div>${
    Array.from({ length: MONTHS }, (_, m) => `<div class="pl-month" style="grid-column:${m + 2}"><span class="pl-long">Месяц </span><span class="pl-short">Мес. </span>${m + 1}</div>`).join('')}</div><div id="pl-rows"></div><div class="pl-col-hl" id="pl-col"></div>`;
  const rowsBox = $('pl-rows');

  function render() {
    // на телефоне в календаре сразу все услуги в порядке сайта, у пустых нет плашек
    const list = phone.matches ? SERVICES.map((s) => rowOf(s) || { s, bars: [] }) : rows;
    const body = list.map((r, i) => `<div class="pl-row${fresh.has('r:' + r.s) && !phone.matches ? ' is-new' : ''}${i >= FOLD ? ' is-extra' : ''}" data-s="${esc(r.s)}"><div class="pl-name"><span>${esc(r.s)}</span><span class="pl-when">${r.bars.length ? monthsText(r.bars) : ''}</span></div>${cells(r)}${
      r.bars.map((b) => barHtml(r, b)).join('')}${armed === r.s ? slots(r) : ''}</div>`).join('');
    const armedNew = armed && !rowOf(armed);
    const drop = armed && !armedNew ? '' :
      `<div class="pl-row pl-drop${armedNew ? ' is-target' : ''}" data-drop><div class="pl-name">${esc(armedNew ? armed! : DROP_LABEL)}</div>${armedNew ? slots({ bars: [] }) : ''}</div>`;
    rowsBox.innerHTML = body + drop;
    grid.querySelectorAll<HTMLElement>('.pl-bar').forEach((el) => fresh.has(+el.dataset.id!) && play(el, 'is-pop'));
    syncChrome();
    if (fresh.size) {   // новые строки раскрываются с нулевой высоты
      void rowsBox.offsetHeight;
      grid.querySelectorAll('.pl-row.is-new').forEach((el) => el.classList.remove('is-new'));
      fresh.clear();
    }
  }
  function syncChrome() {
    document.querySelectorAll('[data-title]').forEach((el) => { el.textContent = touched ? 'Ваш план на полгода' : 'Пример плана на полгода'; });
    document.querySelectorAll<HTMLButtonElement>('[data-restart]').forEach((el) => { el.disabled = !rows.length; });
    chipsBox.querySelectorAll<HTMLElement>('.pl-chip').forEach((c) => {
      const on = c.dataset.s === armed;
      c.classList.toggle('is-armed', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const extra = (phone.matches ? SERVICES.length : rows.length) - FOLD, more = $('pl-more');
    plan.classList.toggle('is-folded', !expanded && extra > 0);
    more.hidden = extra <= 0;
    more.setAttribute('aria-expanded', String(expanded));
    more.firstElementChild!.textContent = expanded ? 'Свернуть' : `Показать ещё ${extra} ${plural(extra, 'услугу', 'услуги', 'услуг')}`;
    ($('pl-mail') as HTMLAnchorElement).href = `mailto:${EMAIL}?subject=${encodeURIComponent('План на полгода')}&body=${encodeURIComponent(planText())}`;
  }

  /* ---------- изменения плана ---------- */
  function commit(msg?: string) {
    wiggleOn = false;
    rows = rows.filter((r) => r.bars.length);
    touched = touched || snapshot() !== EXAMPLE_KEY;
    render();
    if (msg) say(msg);
  }
  function addBar(s: string, start: number) {
    let r = rowOf(s);
    if (r && !free(r, start, 1)) return false;
    if (!r) { r = { s, bars: [] }; rows.push(r); fresh.add('r:' + s); if (rows.length > FOLD) expanded = true; }
    const b = { id: ++uid, start, len: 1, label: s };
    r.bars.push(b);
    r.bars.sort((a, c) => a.start - c.start);
    fresh.add(b.id);
    if (firstAdd) { firstAdd = false; goal('plan_add'); }
    commit(`${s}: добавлено в месяц ${start + 1}`);
    return true;
  }
  function removeBar(id: number) {
    const hit = findBar(id); if (!hit) return;
    const { r, b } = hit, el = rowEl(r.s), last = r.bars.length === 1;
    r.bars = r.bars.filter((x) => x !== b);
    if (selectedId === id) selectedId = null;
    if (last && el && !reduced.matches && !phone.matches) {   // строка сначала схлопывается
      wiggleOn = false; touched = true;
      el.classList.add('is-gone');
      setTimeout(() => commit(`${r.s}: убрано из плана`), 240);
    } else commit(`${b.label}: убрано из плана`);
  }
  function clearAll() {
    if (!rows.length) return;
    document.querySelectorAll('[data-restart]').forEach((el) => play(el, 'is-spin'));
    wiggleOn = false; touched = true; armed = null; selectedId = null;
    const done = () => { rows = []; expanded = false; render(); say('Календарь очищен'); };
    if (reduced.matches || phone.matches) { done(); return; }
    rowsBox.querySelectorAll('.pl-row[data-s]').forEach((el) => el.classList.add('is-gone'));
    setTimeout(done, 240);
  }
  function toggleArm(s: string) {
    armed = armed === s ? null : s;
    selectedId = null;
    if (armed) expanded = true;
    render();
    if (armed) say(`${s}: выберите месяц`);
  }
  function toggleSelect(id: number) {
    selectedId = selectedId === id ? null : id;
    grid.querySelectorAll<HTMLElement>('.pl-bar').forEach((el) => el.classList.toggle('is-selected', +el.dataset.id! === selectedId));
  }

  // телефон: нажатие на ячейку добавляет или убирает месяц; месяц из середины делит плашку,
  // новый месяц склеивается с соседней плашкой, если у неё подпись по названию услуги
  function toggleMonth(s: string, m: number) {
    let r = rowOf(s);
    const b = r && r.bars.find((x) => m >= x.start && m < x.start + x.len);
    if (r && b) {
      if (b.len === 1) r.bars = r.bars.filter((x) => x !== b);
      else if (m === b.start) { b.start++; b.len--; }
      else if (m === b.start + b.len - 1) b.len--;
      else { r.bars.push({ id: ++uid, start: m + 1, len: b.start + b.len - m - 1, label: b.label }); b.len = m - b.start; }
      r.bars.sort((a, c) => a.start - c.start);
      commit(`${s}: месяц ${m + 1} убран`);
      return;
    }
    if (!r) { r = { s, bars: [] }; rows.push(r); }
    const left = r.bars.find((x) => x.start + x.len === m);
    const right = r.bars.find((x) => x.start === m + 1);
    if (left && right && left.label === right.label) { left.len += 1 + right.len; r.bars = r.bars.filter((x) => x !== right); }
    else if (left && left.label === s) left.len++;
    else if (right && right.label === s) { right.start--; right.len++; }
    else { const nb = { id: ++uid, start: m, len: 1, label: s }; r.bars.push(nb); fresh.add(nb.id); }
    r.bars.sort((a, c) => a.start - c.start);
    if (firstAdd) { firstAdd = false; goal('plan_add'); }
    commit(`${s}: добавлен месяц ${m + 1}`);
  }

  /* ---------- геометрия ---------- */
  function cols() {
    const g = grid.getBoundingClientRect();
    const heads = grid.querySelectorAll('.pl-headrow .pl-month');
    const f = heads[0].getBoundingClientRect();
    const last = heads[MONTHS - 1].getBoundingClientRect();
    return { left: f.left, w: (last.right - f.left) / MONTHS, top: g.top, bottom: g.bottom, right: last.right, g };
  }
  type Cols = ReturnType<typeof cols>;
  const monthAt = (x: number, c: Cols) => Math.max(0, Math.min(MONTHS - 1, Math.floor((x - c.left) / c.w)));
  const over = (x: number, y: number, r: { left: number; right: number; top: number; bottom: number }, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  function showCol(m: number | null, c?: Cols) {
    const el = document.getElementById('pl-col'); if (!el) return;
    if (m == null || !c) { el.classList.remove('is-on'); return; }
    el.style.left = (c.left - c.g.left + m * c.w) + 'px';
    el.style.width = c.w + 'px';
    el.classList.add('is-on');
  }
  function ghostIn(row: HTMLElement | null, start = 0) {
    let gh = grid.querySelector<HTMLElement>('.pl-ghost');
    if (!row) { gh?.remove(); return; }
    if (!gh || gh.parentNode !== row) { gh?.remove(); gh = document.createElement('div'); gh.className = 'pl-ghost'; row.appendChild(gh); }
    gh.style.gridColumn = `${start + 2} / span 1`;
  }
  function resetDrop() {
    const d = grid.querySelector('[data-drop]');
    if (d) { d.classList.remove('is-target'); d.querySelector('.pl-name')!.textContent = DROP_LABEL; }
    showCol(null); ghostIn(null);
  }

  /* ---------- перетаскивание: мышь — после сдвига на 4 px, палец — после удержания 280 мс ---------- */
  function arm(e: PointerEvent, kind: 'chip' | 'bar', el: HTMLElement) {
    if (e.button > 0) return;
    const d: Drag = { kind, el, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', live: false };
    if (kind === 'chip') d.s = el.dataset.s;
    else {
      d.barId = +el.dataset.id!;
      const h = (e.target as Element).closest<HTMLElement>('.h');
      d.edge = h ? h.dataset.edge : null;
    }
    if (d.touch) d.timer = window.setTimeout(() => begin(d), HOLD);
    drag = d;
  }
  function begin(d: Drag) {
    if (drag !== d) return;
    d.live = true;
    wiggleOn = false;
    plan.classList.add('is-dragging');
    if (!d.touch) document.documentElement.classList.add('pl-grabbing');
    if (d.touch && navigator.vibrate) navigator.vibrate(8);
    if (d.kind === 'chip') {
      armed = null; expanded = true; render();   // пока тащат услугу, видны все строки и пустая
      d.el = chipsBox.querySelector<HTMLElement>(`[data-s="${CSS.escape(d.s!)}"]`)!;
      d.el.classList.add('is-source');
      d.float = Object.assign(document.createElement('div'), { className: 'pl-float', textContent: d.s! });
      document.body.appendChild(d.float);
    } else {
      const hit = findBar(d.barId!)!;
      Object.assign(d, { r: hit.r, b: hit.b, orig: { start: hit.b.start, len: hit.b.len } });
      d.cand = { ...d.orig! };
      if (selectedId != null) toggleSelect(selectedId);
      d.el.classList.remove('is-wiggle', 'is-pop');
      if (!d.edge) {
        const rect = d.el.getBoundingClientRect();
        d.off = { x: d.x0 - rect.left, y: d.y0 - rect.top };
        d.lift = d.el.cloneNode(true) as HTMLElement;
        d.lift.classList.add('pl-lift');
        d.lift.removeAttribute('tabindex');
        d.lift.style.width = rect.width + 'px';
        document.body.appendChild(d.lift);
        d.el.classList.add('is-placeholder');
        plan.classList.add('is-dragging-bar');
      }
    }
    move(d);
  }
  function move(d: Drag) {
    const c = cols();
    if (d.kind === 'chip') {
      d.float!.style.transform = `translate(${d.x + 10}px, ${d.y - 15}px)`;
      d.target = null;
      if (!over(d.x, d.y, { left: c.left, right: c.right, top: c.top, bottom: c.bottom }, 12)) { resetDrop(); return; }
      const m = monthAt(d.x, c), r = rowOf(d.s!);
      const row = r ? rowEl(d.s!) : grid.querySelector<HTMLElement>('[data-drop]');
      const ok = !r || free(r, m, 1);
      if (!r && row) { row.classList.add('is-target'); row.querySelector('.pl-name')!.textContent = d.s!; }
      showCol(ok ? m : null, c);
      ghostIn(ok ? row : null, m);
      if (ok) d.target = m;
      return;
    }
    const orig = d.orig!, r = d.r!, b = d.b!;
    const step = Math.round((d.x - d.x0) / c.w);
    if (d.edge === 'l') {
      const end = orig.start + orig.len;
      let s = Math.min(end - 1, Math.max(0, orig.start + step));
      while (s < orig.start && !free(r, s, end - s, b.id)) s++;
      d.cand = { start: s, len: end - s };
      showCol(s, c);
    } else if (d.edge === 'r') {
      let len = Math.max(1, Math.min(MONTHS - orig.start, orig.len + step));
      while (len > orig.len && !free(r, orig.start, len, b.id)) len--;
      d.cand = { start: orig.start, len };
      showCol(orig.start + len - 1, c);
    } else {
      const tilt = Math.max(-2, Math.min(2, (d.x - d.x0) / 140));
      d.lift!.style.transform = `translate(${d.x - d.off!.x}px, ${d.y - d.off!.y}px) rotate(${tilt}deg)`;
      d.bin = over(d.x, d.y, palette.getBoundingClientRect());
      trash.classList.toggle('is-hot', d.bin);
      d.lift!.classList.toggle('is-bin', d.bin);
      d.el.classList.toggle('is-bin', d.bin);
      if (!d.bin) {
        const s = Math.max(0, Math.min(MONTHS - orig.len, orig.start + step));
        if (free(r, s, orig.len, b.id)) d.cand = { start: s, len: orig.len };
      }
      showCol(d.bin ? null : d.cand!.start, c);
    }
    d.el.style.gridColumn = `${d.cand!.start + 2} / span ${d.cand!.len}`;
  }
  function finish(d: Drag, cancel: boolean) {
    clearTimeout(d.timer);
    drag = null;
    if (!d.live) return false;
    plan.classList.remove('is-dragging', 'is-dragging-bar');
    document.documentElement.classList.remove('pl-grabbing');
    trash.classList.remove('is-hot');
    showCol(null); ghostIn(null);

    if (d.kind === 'chip') {
      d.el.classList.remove('is-source');
      if (!cancel && d.target != null && addBar(d.s!, d.target)) { d.float!.remove(); return true; }
      resetDrop();   // услуга улетает обратно в список
      const r = d.el.getBoundingClientRect();
      d.float!.classList.add('is-back');
      d.float!.style.transform = `translate(${r.left}px, ${r.top + 4}px)`;
      setTimeout(() => d.float!.remove(), 260);
      return true;
    }

    if (cancel) d.cand = { ...d.orig! };
    const changed = d.cand!.start !== d.orig!.start || d.cand!.len !== d.orig!.len;
    const apply = () => {
      if (changed) {
        Object.assign(d.b!, d.cand);
        d.r!.bars.sort((a, c) => a.start - c.start);
        commit(`${d.b!.label}: ${months(d.b!.start, d.b!.len)}`);
      } else {
        d.el.style.gridColumn = `${d.orig!.start + 2} / span ${d.orig!.len}`;
        d.el.classList.remove('is-placeholder', 'is-bin');
      }
    };
    if (!d.lift) { apply(); return true; }

    if (!cancel && d.bin) {   // брошена на список услуг — убираем
      d.lift.classList.add('is-drop');
      d.lift.style.transform += ' scale(.85)';
      const l = d.lift;
      setTimeout(() => l.remove(), 200);
      removeBar(d.b!.id);
      return true;
    }
    // плашка прилипает к месяцу
    d.el.style.gridColumn = `${d.cand!.start + 2} / span ${d.cand!.len}`;
    d.el.classList.remove('is-bin');
    const to = d.el.getBoundingClientRect();
    const lift = d.lift;
    let landed = false;
    const land = () => { if (landed) return; landed = true; lift.remove(); apply(); };
    if (reduced.matches) { land(); return true; }
    lift.classList.remove('is-bin');
    lift.classList.add('is-land');
    lift.style.transform = `translate(${to.left}px, ${to.top}px)`;
    lift.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') land(); });
    setTimeout(land, 320);
    return true;
  }

  plan.addEventListener('pointerdown', (e) => {
    const t = e.target as Element;
    if (drag || t.closest('.x')) return;
    const chip = t.closest<HTMLElement>('.pl-chip'), bar = t.closest<HTMLElement>('.pl-bar');
    if (!chip && (!bar || bar.classList.contains('is-placeholder'))) return;
    if (e.pointerType === 'mouse') e.preventDefault();   // мышь не выделяет текст страницы, пока тащит
    arm(e, chip ? 'chip' : 'bar', (chip || bar)!);
  });
  window.addEventListener('pointermove', (e) => {
    const d = drag; if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.live) {
      const far = Math.hypot(d.x - d.x0, d.y - d.y0);
      if (d.touch) { if (far > 8) { clearTimeout(d.timer); drag = null; } }   // палец поехал раньше — это прокрутка
      else if (far > 4) begin(d);
      return;
    }
    move(d);
  });
  // пока тащим пальцем, страница стоит на месте
  window.addEventListener('touchmove', (e) => { if (drag && drag.live) e.preventDefault(); }, { passive: false });
  window.addEventListener('pointerup', (e) => {
    const d = drag; if (!d || e.pointerId !== d.id) return;
    if (finish(d, false)) return;
    if (d.kind === 'chip') toggleArm(d.s!);   // просто нажатие
    else toggleSelect(d.barId!);
  });
  window.addEventListener('pointercancel', (e) => { const d = drag; if (d && e.pointerId === d.id) finish(d, true); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) finish(drag, true); });
  plan.addEventListener('contextmenu', (e) => { if ((e.target as Element).closest('.pl-bar, .pl-chip')) e.preventDefault(); });

  /* ---------- нажатия и клавиатура ---------- */
  plan.addEventListener('click', (e) => {
    const t = e.target as Element;
    const cell = t.closest<HTMLElement>('.pl-cell');
    if (cell) { toggleMonth(cell.closest<HTMLElement>('.pl-row')!.dataset.s!, +cell.dataset.m!); return; }
    const x = t.closest('.pl-bar .x');
    if (x) { removeBar(+x.closest<HTMLElement>('.pl-bar')!.dataset.id!); return; }
    const slot = t.closest<HTMLElement>('.pl-slot');
    if (slot && armed) { addBar(armed, +slot.dataset.slot!); return; }
    if (t.closest('[data-restart]')) clearAll();
  });
  phone.addEventListener('change', () => { armed = null; selectedId = null; render(); });
  $('pl-more').addEventListener('click', (e) => {
    expanded = !expanded;
    syncChrome();
    if (!expanded) (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest' });
  });
  chipsBox.addEventListener('keydown', (e) => {
    const chip = (e.target as Element).closest<HTMLElement>('.pl-chip');
    if (chip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleArm(chip.dataset.s!); }
  });
  // нажатие мимо календаря снимает выбор
  document.addEventListener('pointerdown', (e) => {
    if (drag || (e.target as Element).closest('.pl-chip, .pl-slot, .pl-bar, .pl-cell, .pl-more, [data-restart]')) return;
    if (armed) { armed = null; render(); }
    if (selectedId != null) toggleSelect(selectedId);
  });
  // ←/→ двигают плашку, Shift+←/→ меняют длину, Delete убирает
  grid.addEventListener('keydown', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('.pl-bar'); if (!el) return;
    const id = +el.dataset.id!, hit = findBar(id); if (!hit) return;
    const { r, b } = hit;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeBar(id); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const k = e.key === 'ArrowLeft' ? -1 : 1;
    const start = e.shiftKey ? b.start : b.start + k, len = e.shiftKey ? b.len + k : b.len;
    if (!free(r, start, len, id)) return;
    Object.assign(b, { start, len });
    commit(`${b.label}: ${months(start, len)}`);
    grid.querySelector<HTMLElement>(`.pl-bar[data-id="${id}"]`)?.focus();
  });

  /* ---------- подрагивание примера: наведение мышью; на сенсорном — один раз волной ---------- */
  grid.addEventListener('pointerover', (e) => {
    if (!wiggleOn || drag || reduced.matches || e.pointerType !== 'mouse') return;
    const bar = (e.target as Element).closest('.pl-bar');
    if (!bar || bar.contains(e.relatedTarget as Node) || bar.classList.contains('is-wiggle') || bar.classList.contains('is-pop')) return;
    play(bar, 'is-wiggle');
  });
  if (!canHover.matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      if (!wiggleOn || reduced.matches || phone.matches) return;   // на телефоне плашки не тащат
      grid.querySelectorAll('.pl-bar').forEach((bar, i) => setTimeout(() => wiggleOn && play(bar, 'is-wiggle'), 150 + i * 70));
    }, { threshold: 0.5 });
    io.observe(grid);
  }

  /* ---------- план для консультации ---------- */
  function planText() {
    const lines = rows.map((r) => `${r.s}: ` + r.bars.map((b) => (b.label === r.s ? '' : `${b.label}, `) + months(b.start, b.len)).join('; '));
    return ['Здравствуйте! Хочу обсудить план на полгода.', '', ...lines].join('\n');
  }
  let toastT = 0;
  function toast(msg: string) {
    const t = $('pl-toast');
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = window.setTimeout(() => t.classList.remove('is-on'), 3600);
  }
  // копируем сразу в обработчике нажатия: новая вкладка Telegram потом заберёт фокус
  function copyNow(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* старый способ недоступен */ }
    ta.remove();
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    return ok || !!navigator.clipboard;
  }
  const empty = (e: Event) => { if (rows.length) return false; e.preventDefault(); toast('Сначала добавьте в план хотя бы одну услугу'); return true; };
  $('pl-tg').addEventListener('click', (e) => {
    if (empty(e)) return;
    goal('plan_telegram');
    const ok = copyNow(planText());
    setTimeout(() => toast(ok ? 'План скопирован. Вставьте его в сообщение в Telegram.' : 'Не получилось скопировать план. Скачайте PDF и отправьте его в Telegram.'), 50);
  });
  $('pl-mail').addEventListener('click', (e) => { if (!empty(e)) goal('plan_email'); });
  $('pl-pdf').addEventListener('click', async (e) => {
    if (empty(e)) return;
    const btn = e.currentTarget as HTMLElement;
    if (btn.getAttribute('aria-busy')) return;
    btn.setAttribute('aria-busy', 'true');
    try {
      const url = URL.createObjectURL(await buildPdf());
      const a = Object.assign(document.createElement('a'), { href: url, download: 'bat-agency-plan.pdf' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      goal('plan_pdf');
    } catch (err) {
      console.error(err);
      toast('Не получилось собрать PDF. Попробуйте ещё раз.');
    } finally { btn.removeAttribute('aria-busy'); }
  });

  /* ---------- PDF: план шрифтом сайта на холсте → одностраничный PDF A4, без библиотек ---------- */
  async function drawPlan() {
    const PW = 842, PH = 595, K = 3;
    const cv = document.createElement('canvas');
    cv.width = PW * K; cv.height = PH * K;
    const x = cv.getContext('2d')!;
    x.scale(K, K);
    await document.fonts.ready;   // иначе холст возьмёт запасной шрифт
    const F = (w: number, s: number) => `${w} ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const M = 40, ink = '#0A0A0A', grey = '#6B6B6B', line = '#DADADA';
    const fit = (t: string, w: number) => { if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
    const text = (t: string, px: number, py: number, font: string, color: string, align: CanvasTextAlign = 'left') => { x.font = font; x.fillStyle = color; x.textAlign = align; x.fillText(t, px, py); };
    const rrect = (rx: number, ry: number, rw: number, rh: number, rad: number) => { x.beginPath(); x.roundRect(rx, ry, rw, rh, rad); x.fill(); };

    x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH);
    text('Bat Agency', M, M + 6, F(700, 12), ink);
    text(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), PW - M, M + 6, F(400, 10), grey, 'right');
    x.fillStyle = ink; x.fillRect(M, M + 18, PW - 2 * M, 1);
    text('План на полгода', M, M + 64, F(700, 30), ink);

    const top = M + 108, label = 180;
    const rowH = Math.min(34, (PH - top - 80) / rows.length);
    const colW = (PW - 2 * M - label) / MONTHS, barH = Math.min(22, rowH - 8);
    for (let m = 0; m < MONTHS; m++) text(`Месяц ${m + 1}`, M + label + m * colW, top - 10, F(400, 9.5), grey);
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      x.fillStyle = line; x.fillRect(M, y, PW - 2 * M, 0.75);
      x.font = F(400, 11);
      text(fit(r.s, label - 12), M, y + rowH / 2 + 4, F(400, 11), ink);
      r.bars.forEach((b) => {
        const bx = M + label + b.start * colW, bw = b.len * colW - 4, by = y + (rowH - barH) / 2;
        x.fillStyle = ink; rrect(bx, by, bw, barH, 3);
        x.font = F(400, 9.5);
        text(fit(b.label, bw - 14), bx + 7, by + barH / 2 + 3.4, F(400, 9.5), '#fff');
      });
    });
    x.fillStyle = line; x.fillRect(M, top + rows.length * rowH, PW - 2 * M, 0.75);

    x.fillStyle = ink; x.fillRect(M, PH - M - 26, PW - 2 * M, 1);
    text('Обсудим план на бесплатной консультации', M, PH - M - 8, F(500, 11), ink);
    text(`Telegram @${TELEGRAM}   ·   ${EMAIL}`, PW - M, PH - M - 8, F(400, 11), ink, 'right');
    return { cv, PW, PH };
  }

  async function buildPdf() {
    const { cv, PW, PH } = await drawPlan();
    let img: Uint8Array, dict: string;
    if ('CompressionStream' in window) {   // без потерь: оттенки серого + Flate
      const { data } = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height);
      const g = new Uint8Array(cv.width * cv.height);
      for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = data[j];
      img = new Uint8Array(await new Response(new Blob([g]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
      dict = '/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode';
    } else {
      img = new Uint8Array(await (await new Promise<Blob>((res) => cv.toBlob((b) => res(b!), 'image/jpeg', 0.95))).arrayBuffer());
      dict = '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode';
    }
    const enc = new TextEncoder(), parts: Uint8Array[] = [], offs: number[] = [];
    let len = 0;
    const push = (p: string | Uint8Array) => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); len += b.length; };
    const obj = (n: number, body: () => void) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    push('%PDF-1.4\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} ${dict} /Length ${img.length} >>\nstream\n`); push(img); push('\nendstream'); });
    obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    const xref = len;
    push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts as BlobPart[], { type: 'application/pdf' });
  }

  rows = fromExample();
  render();
}
