// Типограф: правила — specs/typography-rules.md. Работает только при сборке (middleware.ts) и только
// с текстом страниц: блоки-плагины рисуют свой текст сами, их не трогаем. Переносы не подбираем под ширину:
// неразрывный пробел сам держит слова вместе на любом экране. Если склейка всё же шире
// колонки, её разорвёт overflow-wrap в global.css. Повторный прогон ничего не меняет.

const NB = ' ';
const L = 'а-яёА-ЯЁa-zA-Z';
// служебные слова, которые не остаются в конце строки
const SHORT = 'в|во|к|ко|с|со|у|о|об|обо|от|ото|до|по|на|за|из|изо|без|для|при|про|над|под|меж|через|а|и|но|да|или|либо|что|как|чтобы|если|не|ни';
const RE_SHORT = new RegExp(`(?<=^|[\\s(«„"—–${NB}])(${SHORT}) (?=[^\\s—–])`, 'giu');
const RE_PART = new RegExp(` (ли|ль|же|ж|бы|б)(?=[\\s.,:;!?…»“)]|$)`, 'gu');
const BRANDS = ['Bat Agency', 'Time Out', 'МТС Live', 'Sound Up', 'Театр на Таганке'];
const RE_LAST = new RegExp(`[ ]([${L}0-9]{1,4}[.,:;!?…»“)]*)\\s*$`, 'u');

function quotes(s: string) {
  let depth = 0, out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '"') { out += c; continue; }
    const prev = s[i - 1];
    const opening = !prev || /[\s(«„—– ]/.test(prev);
    if (opening) { out += depth ? '„' : '«'; depth++; }
    else { depth = Math.max(0, depth - 1); out += depth ? '“' : '»'; }
  }
  return out;
}

// только знаки: для атрибутов, <title> и текста, который посетитель копирует
export function typoSigns(s: string) {
  if (s.includes('"')) s = quotes(s);
  return s
    .replace(/\.{3}/g, '…')
    .replace(/\((c|с)\)/gi, '©')
    .replace(new RegExp(`(?<=[${L}])'(?=[${L}])`, 'g'), '’')
    .replace(/(\S)[  ]+(--?|—)[  ]+/g, `$1${NB}— `)
    // диапазон 10-20; даты 2026-10-24 и телефоны 345-67-89 — цепочки, их не трогаем
    .replace(/(?<![\d-])(\d{1,4})-(\d{1,4})(?![\d-])/g, '$1–$2')
    .replace(/(\d) ?x ?(\d)/g, '$1×$2')
    .replace(/(\d)[  ]+%/g, '$1%');
}

// полный прогон для видимого текста
export function typo(s: string, opts: { last?: boolean } = {}) {
  if (!/\S/.test(s)) return s;
  s = typoSigns(s);
  for (const b of BRANDS) if (s.includes(b)) s = s.split(b).join(b.replace(/ /g, NB));
  s = s
    .replace(RE_SHORT, `$1${NB}`)
    // «дизайн- и digital»: висящий дефис не отрывается от союза
    .replace(new RegExp(`(?<=[${L}])- (?=(и|или)[ ${NB}])`, 'g'), `-${NB}`)
    .replace(RE_PART, `${NB}$1`)
    .replace(/(\d) (?=[а-яёА-ЯЁ%])/g, `$1${NB}`)
    .replace(/([№§]) ?(?=\d)/g, `$1${NB}`)
    .replace(new RegExp(`(?<![${L}])т\\. ?([екдпч])\\.`, 'g'), `т.${NB}$1.`)
    .replace(/(?<![\d #])(\d{2,3})(\d{3})(?!\d)/g, '$1 $2')
    .replace(new RegExp(`([${L}]) +([,.;:!?])(?=\\s|$)`, 'g'), '$1$2')
    // короткая часть у дефиса — неразрывный дефис: «из-за», «по-русски», «PR-план»; пути вроде c:\bat\o-nas не трогаем
    .replace(new RegExp(`(?<![${L}\\\\/.-])([${L}]{1,2})-(?=[${L}])|(?<=[${L}])-([${L}]{1,2})(?![${L}-])`, 'g'),
      (_, a, b) => (a ? `${a}‑` : `‑${b}`));
  if (opts.last) s = s.replace(RE_LAST, `${NB}$1`);
  return s;
}

const SKIP = 'script|style|pre|code|textarea|svg|title|template';
// атрибут в кавычках может содержать «<» и «>» (иконка в data-clear-icon у календаря)
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const RE_TOKEN = new RegExp(`<!--[\\s\\S]*?-->|<(${SKIP})\\b${ATTRS}>[\\s\\S]*?<\\/\\1>|<[!/]?[a-zA-Z]${ATTRS}>`, 'gi');
const RE_ATTR = /(\s(?:alt|title|aria-label|placeholder)=")([^"]*)"/gi;
const INLINE = /^<\/?(a|span|strong|em|b|i|abbr|mark|small|sup|sub|time|label|button)\b/i;
const BLOCK_END = /^<\/(p|li|h[1-6]|dd|dt|td|th|figcaption|summary|blockquote|caption|legend)>/i;

function decode(s: string) {
  return s.replace(/&quot;|&#34;/g, '"').replace(/&#39;|&#x27;/gi, "'").replace(/&nbsp;|&#160;/g, NB);
}

// HTML-страница целиком: текст между тегами, без <script>, <style>, <pre>, <code> и т. п.
export function typoHtml(html: string) {
  const parts: { text: boolean; v: string }[] = [];
  let at = 0;
  for (const m of html.matchAll(RE_TOKEN)) {
    if (m.index! > at) parts.push({ text: true, v: html.slice(at, m.index) });
    parts.push({ text: false, v: m[0] });
    at = m.index! + m[0].length;
  }
  if (at < html.length) parts.push({ text: true, v: html.slice(at) });

  let body = false;
  // элемент целиком без типографа: data-plugin — интерактивный блок со своим скриптом (планировщик,
  // календарь премий, змейка), data-no-typo — текст с переносами как в макете (H1 первого экрана)
  let raw: { tag: string; depth: number } | null = null;
  return parts.map((p, i) => {
    if (!p.text) {
      if (/^<body\b/i.test(p.v)) body = true;
      const tag = /^<(\/?)([a-z][\w-]*)/i.exec(p.v), inRaw = !!raw;
      if (raw && tag && tag[2].toLowerCase() === raw.tag && !p.v.endsWith('/>')) {
        raw.depth += tag[1] ? -1 : 1;
        if (!raw.depth) raw = null;
      } else if (!raw && tag && !tag[1] && /\sdata-(plugin|no-typo)\b/.test(p.v)) raw = { tag: tag[2].toLowerCase(), depth: 1 };
      return !inRaw && !raw && !p.v.startsWith('<!') && !/^<(script|style|pre|code|textarea|svg|template)\b/i.test(p.v)
        ? p.v.replace(RE_ATTR, (_, a, v) => `${a}${typoSigns(v)}"`) : p.v;
    }
    if (!body || raw) return p.v;
    const next = parts[i + 1]?.v ?? '', prev = parts[i - 1]?.v ?? '';
    let s = typo(decode(p.v), { last: BLOCK_END.test(next) });
    // предлог перед ссылкой или выделением: «в <a>Telegram</a>»
    if (INLINE.test(next) && !next.startsWith('</')) s = s.replace(new RegExp(`(?<=^|[\\s${NB}])(${SHORT}) $`, 'iu'), `$1${NB}`);
    // тире сразу после ссылки: «<a>Telegram</a> — пишите»
    if (INLINE.test(prev) && prev.startsWith('</')) s = s.replace(/^ (?=—)/, NB);
    return s;
  }).join('');
}
