// Разбор текстов политик (content/politika-*.md) в блоки страницы на этапе сборки, без библиотек.
// Служебные части файлов («на сайт не переносить») отбрасываются. Поддержано то, что есть в файлах:
// заголовки ##/###, абзацы, списки, таблицы, **жирный**, `код`, [ссылки](…), голые https-ссылки,
// блоки получателей («**Название**» + список «Метка: значение»).
export type Block =
  | { t: 'p'; html: string }
  | { t: 'ul'; items: string[] }
  | { t: 'h2'; id: string; text: string }
  | { t: 'h3'; id?: string; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'recipient'; title: string; rows: [string, string][] };

export type Legal = { title: string; edition: string; blocks: Block[]; toc: { id: string; text: string }[] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function inline(src: string): string {
  let s = esc(src);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => `<a href="${href}">${t}</a>`);
  // голые ссылки, кроме уже обёрнутых
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g, (_, pre, url) => `${pre}<a href="${url}"${url.includes('batagency.co') ? '' : ' rel="noopener" target="_blank"'}>${url}</a>`);
  return s;
}

const TR: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
// якоря как в макете: транслит; «Ваши права» → #prava, пункт 5.1 → #analitika (ссылка из окна cookies)
export function slug(text: string): string {
  const plain = text.replace(/^\d+(\.\d+)*\.\s*/, '');
  if (/^Ваши права/.test(plain)) return 'prava';
  if (/^5\.1\./.test(text)) return 'analitika';
  return plain.toLowerCase().split('').map((c) => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function parseLegal(md: string): Legal {
  // текст страницы — между первым «---» и служебной частью в конце
  const lines = md.split('\n');
  const first = lines.findIndex((l) => l.trim() === '---');
  const tail = lines.findIndex((l, i) => i > first && /^## Служебное/.test(l));
  let body = lines.slice(first + 1, tail > 0 ? tail : undefined);
  while (body.length && (body[body.length - 1].trim() === '' || body[body.length - 1].trim() === '---')) body.pop();

  let title = '', edition = '';
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ t: 'p', html: inline(para.join(' ')) }); para = []; } };

  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const tr = line.trim();
    if (!tr) { flush(); continue; }
    if (tr.startsWith('# ')) { flush(); title = tr.slice(2).trim(); continue; }
    if (/^Редакция от/.test(tr)) { flush(); edition = tr; continue; }
    if (tr.startsWith('## ')) { flush(); const text = tr.slice(3).trim(); blocks.push({ t: 'h2', id: slug(text), text }); continue; }
    if (tr.startsWith('### ')) { flush(); const text = tr.slice(4).trim(); blocks.push({ t: 'h3', id: slug(text), text }); continue; }
    if (tr.startsWith('|')) {
      flush();
      const tbl: string[] = [];
      while (i < body.length && body[i].trim().startsWith('|')) tbl.push(body[i++].trim());
      i--;
      const [head, , ...rest] = tbl;
      blocks.push({ t: 'table', head: cells(head).map(inline), rows: rest.map((r) => cells(r).map(inline)) });
      continue;
    }
    if (tr.startsWith('- ')) {
      flush();
      const items: string[] = [];
      while (i < body.length && body[i].trim().startsWith('- ')) items.push(body[i++].trim().slice(2));
      i--;
      // «**Название**» и следом список «Метка: значение» — блок получателя данных
      const prev = blocks[blocks.length - 1];
      const bold = prev?.t === 'p' && /^<strong>[^<]+<\/strong>$/.test(prev.html);
      if (bold && items.every((it) => /^[^:]{2,40}:\s/.test(it))) {
        blocks.pop();
        blocks.push({
          t: 'recipient',
          title: (prev as { html: string }).html.replace(/<\/?strong>/g, ''),
          rows: items.map((it) => { const k = it.indexOf(':'); return [esc(it.slice(0, k + 1)), inline(it.slice(k + 1).trim())]; }),
        });
      } else blocks.push({ t: 'ul', items: items.map(inline) });
      continue;
    }
    para.push(tr);
  }
  flush();
  const toc = blocks.filter((b): b is Extract<Block, { t: 'h2' }> => b.t === 'h2').map(({ id, text }) => ({ id, text }));
  return { title, edition, blocks, toc };
}
