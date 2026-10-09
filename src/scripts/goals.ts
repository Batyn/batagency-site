// Цели Метрики (ТЗ 9.3). Все вызовы ym идут отсюда: без window.ym (блокировщик, нет согласия) молча ничего не делаем.
const ID = Number(import.meta.env.PUBLIC_YM_ID);

export function goal(name: string): void {
  try { window.ym?.(ID, 'reachGoal', name); } catch { /* Метрика не должна ломать страницу */ }
}

// Ссылки и кнопки с data-goal="…" отправляют цель по нажатию
document.addEventListener('click', (e) => {
  const el = (e.target as Element | null)?.closest<HTMLElement>('[data-goal]');
  if (el?.dataset.goal) goal(el.dataset.goal);
});
