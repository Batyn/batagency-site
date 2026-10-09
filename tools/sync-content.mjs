// Копирует тексты политик из рабочей папки (../content/) в проект сайта перед сборкой.
// Главная версия текстов — branding-agency/content/*.md. Если папки рядом нет (сборка на GitHub),
// берём копии, которые уже лежат в src/legal/.
import { existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = ['politika-konfidencialnosti.md', 'politika-personalnye-dannye.md'];
for (const f of files) {
  const src = join(root, '..', 'content', f);
  if (existsSync(src)) copyFileSync(src, join(root, 'src', 'legal', f));
}
