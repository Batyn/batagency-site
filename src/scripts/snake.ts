// Змейка на первом экране (components/Snake.astro, решения Batın 2026-10-14). Кнопка-змея (без подписи) открывает игру:
// заголовок уезжает вверх, справа поле без рамки. Стенки сквозные — границу видно, когда змея проходит насквозь.
// Пока посетитель не нажал стрелку или не провёл пальцем, змейка ползёт сама (автопилот). Каждая третья еда — на 5 %
// быстрее. Шаг дискретный, без сглаживания. Стоит, когда поле вне экрана или вкладка скрыта.
import { crawl } from './snake-crawl';

type P = [number, number];
const DIRS: Record<string, P> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};
// автопилот медленнее игры: он в боковом зрении, пока читают заголовок
const AUTO_STEP = 170, PLAY_STEP = 140, MIN_STEP = 50, SPEED_UP = 1.05, EVERY = 3;
const IDLE = 4000, OVER = 600, SWIPE = 24, HINT_H = 45, MIN_W = 256, MIN_H = 112;

export function init(root: HTMLElement) {
  const hero = root.closest<HTMLElement>('.hero');
  const title = hero?.querySelector<HTMLElement>('.hero-title');
  const btn = root.querySelector<HTMLButtonElement>('[data-snake-btn]')!;
  const field = root.querySelector<HTMLElement>('[data-snake-field]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-snake-canvas]')!;
  const hint = root.querySelector<HTMLElement>('[data-snake-hint]')!;
  const live = root.querySelector<HTMLElement>('[data-snake-live]')!;
  const ctx = canvas.getContext('2d');
  if (!hero || !title || !ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const desk = matchMedia('(min-width: 761px)');
  const css = getComputedStyle(root);
  const INK = css.getPropertyValue('--ink').trim() || '#0a0a0a', PAPER = css.getPropertyValue('--bg').trim() || '#fff';

  let best = 0;
  try { best = Number(localStorage.getItem('snake-best')) || 0; } catch { /* хранилище недоступно — рекорд только на сессию */ }

  let cols = 0, rows = 0, cell = 16, dpr = 1, ox = 0, oy = 0;
  let snake: P[] = [], food: P = [0, 0], dir: P = [1, 0], queue: P[] = [];
  let mode: 'closed' | 'auto' | 'wait' | 'play' | 'over' = 'closed';
  let score = 0, visible = true, small = false, raf = 0, last = 0, acc = 0, overAt = 0;

  const key = (p: P) => p[0] * 1000 + p[1];
  // стенки сквозные: поле — тор
  const wrap = (x: number, y: number): P => [(x + cols) % cols, (y + rows) % rows];
  const playStep = () => Math.max(MIN_STEP, PLAY_STEP / SPEED_UP ** Math.floor(score / EVERY));

  // насколько заголовок уезжает вверх: на десктопе — почти всё пустое место между логотипом и заголовком,
  // на телефоне — отступ над заголовком, кроме 16 px под шапкой
  function shift(): number {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (desk.matches) {
      const row2 = parseFloat(getComputedStyle(hero!).gridTemplateRows.split(' ')[1]) || 0;
      return Math.max(0, Math.round(row2 - 2 * rem));
    }
    return Math.max(0, Math.round(parseFloat(getComputedStyle(title!).marginTop) - rem));
  }

  // контейнер всегда размером с открытую игру; закрытый круг с подписью — по центру места под заголовком
  function layout() {
    const s = shift();
    hero!.style.setProperty('--snake-shift', `${s}px`);
    const W = root.clientWidth, H = root.clientHeight, b = btn.offsetWidth;
    if (desk.matches) {
      // десктоп: под меню у правого поля, на 16 px ниже места большого логотипа (образец Batın 2026-10-14)
      const space = hero!.querySelector('.hero-space');
      // округляем положение на экране, а не сдвиг: иначе пиксельная змея встаёт на полпикселя и мылится
      const { top: rt, right: rr } = root.getBoundingClientRect();
      const top = space ? Math.round(space.getBoundingClientRect().bottom + 16) - rt : Math.round(rt) - rt;
      root.style.setProperty('--snake-bx', `${Math.round(rr) - rr}px`);
      root.style.setProperty('--snake-by', `${top}px`);
    } else {
      root.style.setProperty('--snake-bx', `${Math.round(-(W - b) / 2)}px`);
      root.style.setProperty('--snake-by', `${Math.round(s + (H - s - b) / 2)}px`);
    }
    // мало места (телефон 360×640, ширины 761–~1100) — ни кнопки, ни игры
    small = W < MIN_W || H - HINT_H < MIN_H || H - s < b + 16;
    root.classList.toggle('is-small', small);
    if (small) close(false);
  }

  function measure(): boolean {
    const r = field.getBoundingClientRect();
    cell = coarse.matches ? 14 : 16;
    const c = Math.floor(r.width / cell), w = Math.floor(r.height / cell);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    // остаток от деления на клетки — поровну по краям; целые пиксели, иначе между звеньями видны швы
    ox = Math.round((r.width - c * cell) / 2); oy = Math.round((r.height - w * cell) / 2);
    const changed = c !== cols || w !== rows;
    cols = c; rows = w;
    return changed;
  }

  function placeFood() {
    const busy = new Set(snake.map(key));
    const free: P[] = [];
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (!busy.has(x * 1000 + y)) free.push([x, y]);
    food = free[Math.floor(Math.random() * free.length)] ?? [0, 0];
  }

  function reset() {
    const y = Math.floor(rows / 2), x = Math.max(3, Math.floor(cols / 3));
    snake = [[x, y], [x - 1, y], [x - 2, y]];
    dir = [1, 0]; queue = []; score = 0;
    placeFood();
  }

  // свободные клетки, достижимые из p; хвост к этому ходу уже уедет
  function room(p: P, body: Set<number>, limit: number): number {
    const seen = new Set([key(p)]), st = [p];
    while (st.length && seen.size < limit) {
      const [x, y] = st.pop()!;
      for (const d of Object.values(DIRS)) {
        const n = wrap(x + d[0], y + d[1]), k = key(n);
        if (!body.has(k) && !seen.has(k)) { seen.add(k); st.push(n); }
      }
    }
    return seen.size;
  }

  // автопилот: кратчайший путь к еде (BFS), если после хода остаётся место; иначе — ход в самую просторную сторону
  function autoDir(): P {
    const head = snake[0], body = new Set(snake.slice(0, -1).map(key)), hk = key(head), fk = key(food);
    const prev = new Map<number, number>([[hk, -1]]), q: P[] = [head];
    for (let i = 0; i < q.length && !prev.has(fk); i++) {
      for (const d of Object.values(DIRS)) {
        const n = wrap(q[i][0] + d[0], q[i][1] + d[1]), k = key(n);
        if (body.has(k) || prev.has(k)) continue;
        prev.set(k, key(q[i])); q.push(n);
      }
    }
    const opts = Object.values(DIRS)
      .map((d) => ({ d, n: wrap(head[0] + d[0], head[1] + d[1]) }))
      .filter(({ n }) => !body.has(key(n)))
      .map((o) => ({ ...o, room: room(o.n, body, snake.length * 2) }));
    if (!opts.length) return dir;
    if (prev.has(fk)) {
      let k = fk;
      while (prev.get(k) !== hk) k = prev.get(k)!;
      const pick = opts.find((o) => key(o.n) === k);
      if (pick && pick.room >= Math.min(snake.length * 2, cols * rows / 3)) return pick.d;
    }
    return opts.sort((a, b) => b.room - a.room)[0].d;
  }

  function step() {
    if (mode === 'auto') dir = autoDir();
    else if (queue.length) dir = queue.shift()!;
    const head = wrap(snake[0][0] + dir[0], snake[0][1] + dir[1]);
    const eat = head[0] === food[0] && head[1] === food[1];
    const body = snake.slice(0, eat ? snake.length : -1);
    if (body.some((s) => s[0] === head[0] && s[1] === head[1])) return die();
    snake.unshift(head);
    if (eat) { score++; placeFood(); } else snake.pop();
    // автопилот не играет вечно: длинная змейка забивает поле — тихо начинаем заново
    if (mode === 'auto' && snake.length > cols * rows * 0.35) reset();
    if (mode === 'play') text();
  }

  function die() {
    if (mode !== 'play') { reset(); return; }
    mode = 'over'; overAt = performance.now();
    if (score > best) {
      best = score;
      try { localStorage.setItem('snake-best', String(best)); } catch { /* без рекорда */ }
    }
    root.classList.add('is-over');
    setTimeout(() => root.classList.remove('is-over'), OVER);
    hint.textContent = `Счёт ${score}. Ещё раз — ${coarse.matches ? 'свайп' : 'стрелка'}`;
    live.textContent = `Счёт ${score}, рекорд ${best}`;
  }

  function text() {
    if (mode === 'play') { hint.textContent = `Счёт ${score} · рекорд ${Math.max(best, score)}`; return; }
    if (mode === 'over') return;
    hint.textContent = (coarse.matches ? hint.dataset.coarse : hint.dataset.fine)!;
  }

  function draw() {
    const fg = root.classList.contains('is-over') ? PAPER : INK;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === 'closed') return;
    ctx!.fillStyle = fg;
    const g = 2, s = cell - g * 2;
    for (let i = 0; i < snake.length; i++) {
      const [x, y] = snake[i];
      ctx!.fillRect(ox + x * cell + g, oy + y * cell + g, s, s);
      // перемычка к следующему звену — тело сплошное; через стенку перемычки нет, там виден разрыв
      const n = snake[i + 1];
      if (n && Math.abs(n[0] - x) + Math.abs(n[1] - y) === 1) {
        const mx = Math.min(x, n[0]), my = Math.min(y, n[1]);
        if (n[0] !== x) ctx!.fillRect(ox + mx * cell + g + s, oy + y * cell + g, g * 2, s);
        else ctx!.fillRect(ox + x * cell + g, oy + my * cell + g + s, s, g * 2);
      }
    }
    // еда — пустой квадрат с контуром: круглых форм в игре нет
    const f = 3, lw = 1.5;
    ctx!.lineWidth = lw; ctx!.strokeStyle = fg;
    ctx!.strokeRect(ox + food[0] * cell + f + lw / 2, oy + food[1] * cell + f + lw / 2, cell - f * 2 - lw, cell - f * 2 - lw);
  }

  function frame(t: number) {
    raf = 0;
    const dt = Math.min(250, t - (last || t)); last = t;
    if (mode === 'over' && t - overAt > IDLE) toAuto();
    if (mode === 'auto' || mode === 'play') {
      acc += dt;
      const speed = mode === 'auto' ? AUTO_STEP : playStep();
      while (acc >= speed) { acc -= speed; step(); if (mode !== 'auto' && mode !== 'play') break; }
    }
    draw();
    loop();
  }
  function loop() {
    const moving = mode === 'auto' || mode === 'play' || mode === 'over';
    if (visible && !small && !document.hidden && moving && !raf) raf = requestAnimationFrame(frame);
    if (!moving) draw();
  }

  // при reduced-motion змейка сама не ползёт — ждёт первой стрелки
  function toAuto() {
    mode = reduced.matches ? 'wait' : 'auto';
    root.classList.remove('is-over');
    text(); last = 0; acc = 0; loop();
  }

  // кнопка: змея ползёт по кольцу; по нажатию, пока кнопка едет в угол поля (500 мс), доползает головой вверх и
  // стоит — в игре всегда головой вверх (решение Batın 2026-10-14). После закрытия ползёт снова
  const ring = crawl([...btn.querySelectorAll<SVGSVGElement>('.snake-art')], () => !reduced.matches && visible && !document.hidden);
  function open() {
    if (mode !== 'closed' || small) return;
    root.classList.add('is-open', 'was-opened');
    ring.park(500);
    hero!.classList.add('is-game');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Закрыть игру');
    measure(); reset();
    toAuto();
    field.focus({ preventScroll: true });
    live.textContent = 'Игра открыта';
  }
  function close(refocus = true) {
    if (mode === 'closed') return;
    mode = 'closed';
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    root.classList.remove('is-open', 'is-over');
    hero!.classList.remove('is-game');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', btn.dataset.label || '');
    if (refocus) btn.focus({ preventScroll: true });
    ring.resume();
    draw();
  }

  function turn(name: string) {
    const d = DIRS[name], prev = queue[queue.length - 1] ?? dir;
    if (mode === 'auto' || mode === 'wait' || mode === 'over') {
      // управление получает та же змейка, что ползла, — укороченная до 4 звеньев, со счётом с нуля
      if (mode === 'over' || snake.length < 3) reset();
      else { snake = snake.slice(0, 4); queue = []; score = 0; }
      root.classList.remove('is-over');
      // первый ход не может быть назад, в собственное тело
      dir = d[0] === -dir[0] && d[1] === -dir[1] ? dir : d;
      mode = 'play'; last = 0; acc = 0; text(); loop();
      return;
    }
    if (mode !== 'play' || queue.length > 1) return;
    if ((d[0] === prev[0] && d[1] === prev[1]) || (d[0] === -prev[0] && d[1] === -prev[1])) return;
    queue.push(d);
  }

  btn.addEventListener('click', () => (mode === 'closed' ? open() : close()));
  root.addEventListener('keydown', (e) => {
    if (mode === 'closed') return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const name = KEYS[e.code];
    if (!name) return;
    e.preventDefault();
    turn(name);
  });

  // свайп: направление решаем, как только палец прошёл 24 px; можно вести змейку, не отрывая пальца
  let sx = 0, sy = 0, swiping = false;
  field.addEventListener('pointerdown', (e) => {
    if (mode === 'closed') return;
    if (e.pointerType === 'mouse') { field.focus({ preventScroll: true }); return; }
    sx = e.clientX; sy = e.clientY; swiping = true;
    field.setPointerCapture(e.pointerId);
  });
  field.addEventListener('pointermove', (e) => {
    if (!swiping) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    sx = e.clientX; sy = e.clientY;
  });
  const end = () => { swiping = false; };
  field.addEventListener('pointerup', end);
  field.addEventListener('pointercancel', end);

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; loop(); ring.update(); }).observe(root);
  document.addEventListener('visibilitychange', () => { last = 0; loop(); ring.update(); });
  reduced.addEventListener('change', () => { if (mode === 'auto' || mode === 'wait') toAuto(); ring.update(); });
  coarse.addEventListener('change', text);

  function fit() {
    layout();
    if (mode !== 'closed' && measure()) reset();
    draw(); loop();
  }
  const ro = new ResizeObserver(fit);
  ro.observe(root); ro.observe(field);

  root.hidden = false;
  text();
  fit();
  requestAnimationFrame(() => root.classList.add('is-ready'));
}
