// В вёрстке Markdown длинное тире показываем одним «-», как в старых программах (Batın 2026-10-24).
// Только в тексте страниц: блоки-плагины (data-plugin) рисуют свой текст сами, их не трогаем.
const root = document.documentElement;
const SKIP = 'script, style, pre, code, textarea, svg, [contenteditable], [data-plugin]';
// узел → его текст с длинными тире, пока включена вёрстка Markdown
const dashed = new WeakMap<Text, string>();

function sync() {
  const on = root.dataset.theme === 'term';
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    if (on) {
      if (!n.data.includes('—') || n.parentElement?.closest(SKIP)) continue;
      dashed.set(n, n.data);
      n.data = n.data.replace(/—/g, '-');
    } else {
      const s = dashed.get(n);
      if (s !== undefined && n.data === s.replace(/—/g, '-')) n.data = s;
      dashed.delete(n);
    }
  }
}

if (root.dataset.theme === 'term') sync();
addEventListener('themechange', sync);
