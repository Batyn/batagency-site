// Кнопка змейки: змея ползёт по кольцу из 32 клеток против часовой, как в игре — шаг на клетку, без вращения,
// пиксели всегда целые (решение Batın 2026-10-14, прототип prototypes/snake-crawl-variants.html). Между головой
// и хвостом разрыв 2 клетки, 6 шагов в секунду. Голова — рисунок из Figma (эталон змея.svg), повёрнутый на 90°
// по стороне кольца. Положение «головой вверх» (голова на месте 0) совпадает с рисунком в Snake.astro.
type Grid = { cell: number; step: number; x0: number; y0: number; head: number; notch: number[]; eye: number[]; tip: number[] };
// клетка, шаг сетки, начало сетки, голова 2×; вырез пасти, глаз, кончик хвоста — для головы «смотрит влево»
const GRIDS: Record<string, Grid> = {
  75: { cell: 5, step: 7, x0: 7, y0: 7, head: 11, notch: [0, 3, 4, 6], eye: [6, 1, 3], tip: [4, 2, 2] },
  72: { cell: 5, step: 7, x0: 5, y0: 6, head: 11, notch: [0, 3, 4, 6], eye: [6, 1, 3], tip: [4, 2, 2] },
  45: { cell: 3, step: 4, x0: 5, y0: 5, head: 7, notch: [0, 2, 3, 3], eye: [4, 1, 2], tip: [3, 1, 1] },
};
// кольцо по часовой (колонка, ряд сетки 9×9), начиная с места головы
const LOOP = [[3,0],[4,0],[5,0],[6,0],[6,1],[7,1],[7,2],[8,2],[8,3],[8,4],[8,5],[8,6],[7,6],[7,7],[6,7],[6,8],
  [5,8],[4,8],[3,8],[2,8],[2,7],[1,7],[1,6],[0,6],[0,5],[0,4],[0,3],[0,2],[1,2],[1,1],[2,1],[2,0]];
const N = LOOP.length, GAP = 2, STEP = 1000 / 6, HEAD_OFF = 2;
const at = (i: number) => LOOP[((i % N) + N) % N];
const r = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;

// голова смотрит вдоль стороны кольца, а не по шагу — иначе на ступеньках перескакивает каждый шаг
function facing([c, rw]: number[]): number[] {
  const dx = c - 4, dy = rw - 4, ax = Math.abs(dx), ay = Math.abs(dy);
  if (dy < 0 && ax <= ay && !(dx > 0 && ax === ay)) return [-1, 0];
  if (dx < 0 && (ay < ax || (dy > 0 && ax === ay))) return [0, 1];
  if (dy > 0 && (ax < ay || (dx > 0 && ax === ay))) return [1, 0];
  return [0, -1];
}
// поворот прямоугольника головы на 90° кратно
function turn([x, y, w, h]: number[], H: number, d: number[]): number[] {
  if (d[0] === -1) return [x, y, w, h];
  if (d[0] === 1) return [H - x - w, H - y - h, w, h];
  if (d[1] === -1) return [H - y - h, x, h, w];
  return [y, H - x - w, h, w];
}

function paths(g: Grid, head: number): [string, string] {
  const len = N - GAP;
  const px = (i: number) => { const [c, rw] = at(i); return [g.x0 + c * g.step, g.y0 + rw * g.step]; };
  // клетку под головой не рисуем — закрасила бы пасть; первая клетка тела заходит под затылок
  const [fx, fy] = px(head + 1);
  let d = r(fx, fy, g.cell, g.cell);
  for (let k = 2; k < len; k++) {
    const [ax, ay] = px(head + k), [bx, by] = px(head + k - 1);
    d += r(Math.min(ax, bx), Math.min(ay, by), Math.abs(ax - bx) + g.cell, Math.abs(ay - by) + g.cell);
  }
  const last = px(head + len - 1), next = px(head + len);
  const tx = Math.sign(next[0] - last[0]), ty = Math.sign(next[1] - last[1]);
  const [L, W, o] = g.tip;
  d += tx ? r(tx > 0 ? last[0] + g.cell : last[0] - L, last[1] + o, L, W)
    : r(last[0] + o, ty > 0 ? last[1] + g.cell : last[1] - L, W, L);
  const dir = facing(at(head)), [hx0, hy0] = px(head), H = g.head;
  const hx = hx0 + g.cell / 2 - dir[0] * HEAD_OFF - H / 2, hy = hy0 + g.cell / 2 - dir[1] * HEAD_OFF - H / 2;
  const [nx, ny, nw, nh] = g.notch;
  for (const p of [[nw, 0, H - nw, H], [0, 0, nw, ny], [0, ny + nh, nw, H - ny - nh]]) {
    const [x, y, w, h] = turn(p, H, dir); d += r(hx + x, hy + y, w, h);
  }
  const [ex, ey, es] = g.eye, [qx, qy] = turn([ex, ey, es, es], H, dir);
  return [d, r(hx + qx, hy + qy, es, es)];
}

// running(): можно ли сейчас ползти (не reduced-motion, кнопка на экране, вкладка видна)
export function crawl(svgs: SVGSVGElement[], running: () => boolean) {
  const arts = svgs.map((s) => ({ g: GRIDS[s.viewBox.baseVal.width], body: s.querySelector('path:not(.snake-eye)')!, eye: s.querySelector('.snake-eye')! }));
  let head = 0, timer = 0, parked = false, until = 0;
  function draw() {
    for (const a of arts) { const [b, e] = paths(a.g, head); a.body.setAttribute('d', b); a.eye.setAttribute('d', e); }
  }
  function tick() {
    timer = 0;
    head = (head - 1 + N) % N;
    draw();
    if (parked && head === 0) return;
    schedule();
  }
  function schedule() {
    clearTimeout(timer); timer = 0;
    if (parked) {
      if (head === 0) return;
      // доползает головой вверх, пока кнопка едет в угол (until — к этому моменту), но не быстрее 60 шагов в секунду
      if (!running()) { head = 0; draw(); return; }
      timer = window.setTimeout(tick, Math.max(1000 / 60, (until - performance.now()) / head));
      return;
    }
    if (running()) timer = window.setTimeout(tick, STEP);
  }
  draw();
  return {
    // встать головой вверх за ms и стоять
    park(ms: number) { parked = true; until = performance.now() + ms; schedule(); },
    resume() { parked = false; schedule(); },
    // пересчитать после смены видимости или reduced-motion
    update: schedule,
  };
}
