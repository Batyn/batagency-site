// «Календарь премий»: всё, что считается от сегодняшней даты, и HTML блоков.
// Одни и те же функции работают при сборке (страница читается без JS, дата — день сборки)
// и в браузере (awards.ts пересчитывает от даты посетителя). Данные — только из data/awards.ts.
import { AWARDS, DATA_DATE, type Award, type AwardKind } from '../data/awards';

export type Filter = 'all' | AwardKind;

// Даты — номера дней от 1970-01-01 по UTC: так часовой пояс посетителя не сдвигает день
const DAY = 86_400_000;
export const dayNum = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
export const todayNum = (now = new Date()): number => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY;
const parts = (n: number) => {
  const d = new Date(n * DAY);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7 };
};
/** месяц как одно число: год × 12 + месяц */
export const monthOf = (n: number): number => { const p = parts(n); return p.y * 12 + p.m; };
const daysIn = (mi: number) => new Date(Date.UTC(Math.floor(mi / 12), (mi % 12) + 1, 0)).getUTCDate();
const firstDay = (mi: number) => Date.UTC(Math.floor(mi / 12), mi % 12, 1) / DAY;

const M_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const M_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const M_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const WD = [['пн', 'понедельник'], ['вт', 'вторник'], ['ср', 'среда'], ['чт', 'четверг'], ['пт', 'пятница'], ['сб', 'суббота'], ['вс', 'воскресенье']];

export const monthTitle = (mi: number) => `${M_NOM[mi % 12]} ${Math.floor(mi / 12)}`;

export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
const PREMIUM: [string, string, string] = ['премия', 'премии', 'премий'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n: number) => String(n).padStart(2, '0');
const ddmm = (n: number) => { const p = parts(n); return `${pad(p.d)}.${pad(p.m + 1)}`; };
const tilde = (a: Award) => (a.approx ? '~' : '');
export const todayText = (today: number) => { const p = parts(today); return `Сегодня, ${p.d} ${M_GEN[p.m]}`; };

export interface Item extends Award { day?: number; passed: boolean }

/** Премии по ближайшему сроку; круглогодичные — после датированных, прошедшие — в конце */
export function items(today: number): Item[] {
  const all: Item[] = AWARDS.map((a) => {
    const day = a.deadline ? dayNum(a.deadline) : undefined;
    return { ...a, day, passed: day !== undefined && day < today };
  });
  const rank = (i: Item) => (i.passed ? 2 : i.yearRound ? 1 : 0);
  // sort стабильный: при равных датах порядок как в data/awards.ts
  return all.sort((x, y) => rank(x) - rank(y) || (x.day ?? 0) - (y.day ?? 0));
}

export const counts = () => ({
  all: AWARDS.length,
  ru: AWARDS.filter((a) => a.kind === 'ru').length,
  intl: AWARDS.filter((a) => a.kind === 'intl').length,
});

// ---------- подписи дат ----------

/** таймлайн: «до 30.10», «до ~14.01», «~ февраль», «приём закрыт 07.10» */
const timelineLabel = (i: Item) => {
  const date = i.monthOnly ? `~ ${M_NOM[parts(i.day!).m].toLowerCase()}` : `${tilde(i)}${ddmm(i.day!)}`;
  if (i.passed) return `приём закрыт ${date}`;
  return i.monthOnly ? date : `до ${date}`;
};
/** список: дата всегда с годом */
const listDate = (i: Item) => {
  if (i.yearRound) return 'всегда';
  const p = parts(i.day!);
  if (i.monthOnly) return `~ ${M_SHORT[p.m].toLowerCase()} ${p.y}`;
  return `${tilde(i)}${ddmm(i.day!)}.${p.y}`;
};
const monthListDate = (i: Item) => (i.monthOnly ? `~ ${M_SHORT[parts(i.day!).m].toLowerCase()}` : `${tilde(i)}${ddmm(i.day!)}`);
const fee = (i: Item) => i.feeRub ?? 'уточняется';

// ---------- сводка ----------

export function renderSummary(today: number): string {
  const list = items(today);
  const c = counts();
  const next = list.find((i) => !i.passed && !i.yearRound);
  const open = list.filter((i) => !i.passed && (i.yearRound || i.openOnDataDate));

  let nextBig = '—';
  let nextNote = 'Сроки следующего сезона ещё не объявлены';
  if (next) {
    const p = parts(next.day!);
    const left = next.day! - today;
    nextBig = next.monthOnly ? `~ ${M_NOM[p.m].toLowerCase()}` : `${tilde(next)}${p.d} ${M_GEN[p.m]}`;
    const leftText = left === 0
      ? 'Последний день — сегодня'
      : `${plural(left, ['Остался', 'Осталось', 'Осталось'])} ${left} ${plural(left, ['день', 'дня', 'дней'])}`;
    nextNote = `${next.name}. ${leftText}`;
  }

  const tile = (label: string, big: string, note: string) =>
    `<div class="aw-tile"><p class="aw-tile-l">${label}</p><p class="aw-tile-b">${esc(big)}</p><p class="aw-tile-n">${esc(note)}</p></div>`;
  return [
    tile('В календаре', `${c.all} ${plural(c.all, PREMIUM)}`,
      `${c.ru} ${plural(c.ru, ['российская', 'российские', 'российских'])} и ${c.intl} ${plural(c.intl, ['международная', 'международные', 'международных'])}: брендинг, дизайн, digital, эффективность`),
    tile('Ближайший дедлайн', nextBig, nextNote),
    tile('Приём идёт сейчас', `${open.length} ${plural(open.length, PREMIUM)}`, open.map((i) => i.short).join(', ') || 'Сейчас приём закрыт'),
  ].join('');
}

// ---------- фильтр ----------

export function renderFilter(short = false): string {
  const c = counts();
  const chip = (f: Filter, text: string) =>
    `<button type="button" class="aw-chip" data-filter="${f}" aria-pressed="${f === 'all'}">${text}</button>`;
  return chip('all', short ? 'Все' : `Все · ${c.all}`) + chip('ru', `Российские · ${c.ru}`) + chip('intl', `Международные · ${c.intl}`);
}

// ---------- десктоп: таймлайн на 12 месяцев с текущего ----------

export function renderTimeline(today: number): string {
  const start = monthOf(today);
  /** положение дня на шкале, доля от 0 до 1; до начала шкалы — 0 */
  const x = (n: number) => {
    const p = parts(n);
    const f = (p.y * 12 + p.m - start + (p.d - 1) / daysIn(p.y * 12 + p.m)) / 12;
    return Math.min(1, Math.max(0, f));
  };
  const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
  const tx = x(today);

  const months = Array.from({ length: 12 }, (_, k) => {
    const mi = start + k;
    const year = k === 0 || mi % 12 === 0 ? `<span class="tl-y">${Math.floor(mi / 12)}</span>` : '';
    return `<span class="tl-m">${year}${M_SHORT[mi % 12]}</span>`;
  }).join('');

  const rows = items(today).map((i) => {
    let track: string;
    if (i.yearRound) {
      track = '<div class="tl-track"><span class="tl-bar">круглый год</span></div>';
    } else {
      const f = x(i.day!);
      // в конце шкалы (ADCE) подпись слева от отметки; awards.ts переставит и другие, если не влезут до колонки взноса
      const cls = i.passed ? ' is-passed' : f > 11 / 12 ? ' is-flip' : '';
      track = `<div class="tl-track" style="--x:${pct(f)}"><span class="tl-mark${i.passed ? ' is-passed' : ''}"></span>`
        + `<span class="tl-lbl${cls}">${esc(timelineLabel(i))}</span></div>`;
    }
    const cur = i.feeRub === null ? 'уточняется' : i.feeCur;
    return `<li class="tl-row${i.passed ? ' is-passed' : ''}" data-kind="${i.kind}">`
      + `<div class="tl-name"><span class="tl-n">${esc(i.name)}</span><span class="tl-c">${esc(i.country)}</span></div>`
      + track
      + `<div class="tl-fee"><span>${esc(i.feeRub ?? '—')}</span>${cur ? `<span class="tl-cur">${esc(cur)}</span>` : ''}</div></li>`;
  }).join('');

  return `<div class="tl" style="--today:${pct(tx)};--today-f:${tx.toFixed(5)}">`
    + '<div class="tl-lines" aria-hidden="true">' + '<span></span>'.repeat(12) + '</div>'
    + '<span class="tl-now" aria-hidden="true"></span>'
    + `<div class="tl-top" aria-hidden="true"><span>Премия</span><div class="tl-months">${months}</div><span class="tl-fee-h">Взнос за проект</span></div>`
    + `<ol class="tl-rows">${rows}</ol>`
    + `<p class="tl-now-l">${todayText(today)}</p></div>`;
}

// ---------- телефон: «Список» ----------

export function renderList(today: number): string {
  const rows = items(today).map((i) =>
    `<li class="ls-row${i.passed ? ' is-passed' : ''}" data-kind="${i.kind}">`
    + `<div class="ls-name"><span class="ls-n">${esc(i.name)}</span><span class="ls-c">${esc(i.country)}${i.passed ? ' · срок прошёл' : ''}</span></div>`
    + `<div class="ls-meta"><span class="ls-d">${esc(listDate(i))}</span><span class="ls-f">${esc(fee(i))}</span></div></li>`,
  ).join('');
  return `<div class="ls-head" aria-hidden="true"><span>Премия</span><span>Срок · взнос</span></div><ul class="ls">${rows}</ul>`;
}

// ---------- телефон: «Месяц» ----------

type Mark = 'deadline' | 'passed';
const LEGEND = {
  deadline: '<li><i class="sw"></i>дедлайн</li>',
  today: '<li><i class="sw sw--today"></i>сегодня</li>',
  passed: '<li><i class="sw sw--passed"></i>срок прошёл</li>',
};

/** премии со сроком в этом месяце (круглогодичные сюда не входят) */
const inMonth = (today: number, mi: number) => items(today).filter((i) => i.day !== undefined && monthOf(i.day) === mi)
  .sort((a, b) => a.day! - b.day!);

/** первый и последний месяц, доступные стрелками: те же 12 месяцев, что на шкале десктопа */
export const monthRange = (today: number) => [monthOf(today), monthOf(today) + 11] as const;

export function renderMonth(today: number, mi: number): string {
  const [min, max] = monthRange(today);
  const list = inMonth(today, mi);
  const isCurrent = mi === monthOf(today);
  const first = firstDay(mi);
  const lead = parts(first).wd;
  const n = daysIn(mi);
  const marks = new Map<number, { mark: Mark; names: string[] }>();
  for (const i of list) {
    if (i.monthOnly) continue;
    const d = parts(i.day!).d;
    const m = marks.get(d) ?? { mark: i.passed ? 'passed' : 'deadline', names: [] };
    m.names.push(i.name);
    marks.set(d, m);
  }

  let cells = '';
  const total = Math.ceil((lead + n) / 7) * 7;
  for (let k = 0; k < total; k++) {
    if (k % 7 === 0) cells += '<tr>';
    const d = k - lead + 1;
    if (d < 1 || d > n) { cells += '<td></td>'; } else {
      const day = first + d - 1;
      const mk = marks.get(d);
      const cls = ['d'];
      if (day < today || k % 7 >= 5) cls.push('is-dim');
      if (day === today) cls.push('is-today');
      if (mk) cls.push(mk.mark === 'passed' ? 'is-passed' : 'is-deadline');
      const label = mk
        ? ` aria-label="${d} ${M_GEN[mi % 12]}: ${esc(mk.names.join(', '))}, ${mk.mark === 'passed' ? 'срок прошёл' : 'последний день подачи'}"`
        : day === today ? ` aria-label="${d} ${M_GEN[mi % 12]}, сегодня"` : '';
      cells += `<td><span class="${cls.join(' ')}"${label}>${d}</span></td>`;
    }
    if (k % 7 === 6) cells += '</tr>';
  }

  const hasDeadline = list.some((i) => !i.passed);
  const hasPassed = list.some((i) => i.passed);
  // в легенде только то, что есть в этом месяце; если одни дедлайны — подпись полностью (как в макете за ноябрь)
  let legend = '';
  if (isCurrent) legend = (hasDeadline ? LEGEND.deadline : '') + LEGEND.today + (hasPassed ? LEGEND.passed : '');
  else if (hasDeadline) legend = '<li><i class="sw"></i>последний день подачи</li>';

  let rows = '';
  let todayShown = false;
  for (const i of list) {
    if (isCurrent && !todayShown && !i.passed) { rows += `<li class="mo-now"><span>${todayText(today)}</span></li>`; todayShown = true; }
    rows += `<li class="mo-row${i.passed ? ' is-passed' : ''}"><i class="mo-mk${i.passed ? ' is-passed' : ''}" aria-hidden="true"></i>`
      + `<span class="mo-d">${esc(monthListDate(i))}</span><div class="mo-t"><span class="mo-n">${esc(i.name)}</span>`
      + `<span class="mo-c">${esc(i.country)} · ${esc(i.feeRub ?? 'взнос уточняется')}${i.passed ? ' · срок прошёл' : ''}</span></div></li>`;
  }
  if (isCurrent && list.length && !todayShown) rows += `<li class="mo-now"><span>${todayText(today)}</span></li>`;

  const arrow = (step: number, ch: string, label: string, off: boolean) =>
    `<button type="button" class="mo-arrow" data-step="${step}" aria-label="${label}"${off ? ' disabled' : ''}>${ch}</button>`;
  const title = monthTitle(mi);
  return `<div class="mo-head">${arrow(-1, '←', 'Предыдущий месяц', mi <= min)}<p class="mo-title">${title}</p>${arrow(1, '→', 'Следующий месяц', mi >= max)}</div>`
    + `<table class="mo-grid"><caption class="sr">${title}</caption><thead><tr>${WD.map(([s, l]) => `<th scope="col" abbr="${l}">${s}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>`
    + (legend ? `<ul class="aw-legend aw-legend--m">${legend}</ul>` : '')
    + (rows ? `<ul class="mo-list">${rows}</ul>` : '<p class="mo-empty">В этом месяце премий нет.</p>');
}

/** для aria-live: «Ноябрь 2026: 4 премии» */
export function monthAnnounce(today: number, mi: number): string {
  const k = inMonth(today, mi).length;
  return `${monthTitle(mi)}: ${k ? `${k} ${plural(k, PREMIUM)}` : 'премий нет'}`;
}

// ---------- телефон: «Весь год» ----------

export function renderYear(today: number): string {
  const [min] = monthRange(today);
  const all = items(today);
  const tiles = Array.from({ length: 12 }, (_, k) => {
    const mi = min + k;
    const list = all.filter((i) => i.day !== undefined && monthOf(i.day) === mi);
    const marks = new Map<number, Mark>();
    for (const i of list) if (!i.monthOnly) marks.set(parts(i.day!).d, i.passed ? 'passed' : marks.get(parts(i.day!).d) ?? 'deadline');
    const first = firstDay(mi);
    const lead = parts(first).wd;
    const n = daysIn(mi);
    let cells = '';
    // всегда 6 недель: все мини-месяцы одной высоты
    for (let c = 0; c < 42; c++) {
      const d = c - lead + 1;
      if (d < 1 || d > n) { cells += '<i></i>'; continue; }
      const mk = marks.get(d);
      const cls = mk === 'passed' ? 'is-passed' : mk === 'deadline' ? 'is-deadline' : first + d - 1 === today ? 'is-today' : 'is-day';
      cells += `<i class="${cls}"></i>`;
    }
    // число у названия — предстоящие дедлайны; прошедший срок виден только кругом (как в макете за октябрь)
    const count = list.filter((i) => !i.passed).length;
    const name = M_NOM[mi % 12];
    const label = `${name} ${Math.floor(mi / 12)}: ${count ? `${count} ${plural(count, ['дедлайн', 'дедлайна', 'дедлайнов'])}` : 'дедлайнов нет'}`;
    return `<li><button type="button" class="yr-m${count ? '' : ' is-empty'}" data-mi="${mi}" aria-label="${label}">`
      + `<span class="yr-h" aria-hidden="true"><span>${name}</span><span>${count || '—'}</span></span>`
      + `<span class="yr-g" aria-hidden="true">${cells}</span></button></li>`;
  }).join('');
  return `<ul class="yr">${tiles}</ul>`
    + `<ul class="aw-legend aw-legend--y">${LEGEND.deadline}${LEGEND.today}${LEGEND.passed}</ul>`
    + '<p class="yr-hint">Нажмите на месяц, чтобы открыть его. Пик подачи — октябрь, ноябрь и февраль.</p>';
}

// ---------- сноска ----------

export function dataDateText(): string {
  const p = parts(dayNum(DATA_DATE));
  return `${p.d} ${M_GEN[p.m]} ${p.y}`;
}
