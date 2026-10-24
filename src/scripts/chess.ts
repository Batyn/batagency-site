// Шахматы в подвале (components/Chess.astro, задача 97). Грузится по первому нажатию на коня. Правила — chess.js, соперник —
// для посетителя «Bat», под капотом Stockfish 10 в Web Worker (public/stockfish/, однопоточный, особых заголовков сервера
// не требует). Партия живёт в sessionStorage: закрыли и открыли подвал или перешли на другую страницу — доска та же.
// Победа даёт скидку по самому лёгкому уровню, на котором Bat ходил в этой партии (переключить на «Сложно» перед матом
// не поможет), и промокод; «Использовать промокод» подставляет его в бриф. Правая кнопка мыши — стрелки и отметки клеток
// (как на lichess и chess.com), в панели — съеденные фигуры и перевес в очках.
import { Chess, type Move, type Square } from 'chess.js';
import { PIECES, PIECE_VIEWBOX, type PieceType } from '../data/chess-pieces';

type Side = 'w' | 'b';
const ENGINE = '/stockfish/stockfish.js';
// «Легко» — слабейший уровень Stockfish и почти без раздумий: любитель выигрывает; «Сложно» — в полную силу
const LEVELS = [{ skill: 0, time: 150, off: 5 }, { skill: 6, time: 400, off: 10 }, { skill: 20, time: 1200, off: 20 }];
const KEY = 'bat-chess';
const FILES = 'abcdefgh';
const NAMES: Record<PieceType, string> = { p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король' };
const FEM = new Set<PieceType>(['p', 'r']);
const PROMO: PieceType[] = ['q', 'r', 'b', 'n'];
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
const LOAD_TIMEOUT = 15000, MIN_THINK = 350, DRAG = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function pieceSvg(color: Side, type: PieceType, cls = 'pc'): string {
  return `<svg class="${cls}" viewBox="${PIECE_VIEWBOX}" aria-hidden="true">${PIECES[color + type]}</svg>`;
}

function makeCode(off: number): string {
  const r = crypto.getRandomValues(new Uint8Array(4));
  return `BAT${off}-` + [...r].map((n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

function describe(m: Move): string {
  if (m.san.startsWith('O-O-O')) return 'длинная рокировка';
  if (m.san.startsWith('O-O')) return 'рокировка';
  const promo = m.promotion ? ` (${NAMES[m.promotion as PieceType]})` : '';
  return `${NAMES[m.piece as PieceType]} ${m.from}–${m.to}${promo}`;
}

function pieceLabel(color: Side, type: PieceType): string {
  const adj = color === 'w' ? (FEM.has(type) ? 'белая' : 'белый') : (FEM.has(type) ? 'чёрная' : 'чёрный');
  return `${adj} ${NAMES[type]}`;
}

export function init(root: HTMLElement, btn: HTMLButtonElement) {
  const ftIn = root.closest('.ft')?.querySelector<HTMLElement>('.ft-in') ?? null;
  const board = root.querySelector<HTMLElement>('[data-chess-board]')!;
  const title = root.querySelector<HTMLElement>('#chess-title')!;
  const status = root.querySelector<HTMLElement>('[data-chess-status]')!;
  const sub = root.querySelector<HTMLElement>('[data-chess-sub]')!;
  const scoreBat = root.querySelector<HTMLElement>('[data-chess-score="bat"]')!;
  const scoreYou = root.querySelector<HTMLElement>('[data-chess-score="you"]')!;
  const levels = [...root.querySelectorAll<HTMLInputElement>('input[name="chess-level"]')];
  const sides = [...root.querySelectorAll<HTMLInputElement>('input[name="chess-side"]')];
  const prize = root.querySelector<HTMLElement>('[data-chess-prize]')!;
  const codeEl = root.querySelector<HTMLElement>('[data-chess-code]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 760px)');

  const game = new Chess();
  let side: Side = 'w';
  let level = 1;
  let minLevel = 1; // самый лёгкий уровень, на котором Bat ходил в этой партии, — от него скидка
  let code = '';
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (saved) {
      if (saved.side === 'w' || saved.side === 'b') side = saved.side;
      if (LEVELS[saved.level]) level = minLevel = saved.level;
      if (LEVELS[saved.minLevel]) minLevel = saved.minLevel;
      if (typeof saved.code === 'string') code = saved.code;
      if (saved.pgn) game.loadPgn(saved.pgn);
    }
  } catch { game.reset(); }
  levels.forEach((i) => (i.checked = +i.value === level));
  sides.forEach((i) => (i.checked = i.value === side));

  let sel: Square | null = null;
  let focusSq: Square = side === 'w' ? 'e2' : 'e7';
  let pendingPromo: { from: Square; to: Square } | null = null;
  let thinking = false;
  let gen = 0;
  let open = false;

  const save = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ pgn: game.pgn(), side, level, minLevel, code })); } catch { /* приватный режим — без сохранения */ }
  };

  // ---------- движок ----------
  let worker: Worker | null = null;
  let engineState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let ready: Promise<boolean> | null = null;
  let sent = 0, got = 0;
  let onBest: ((uci: string) => void) | null = null;

  function startEngine(): Promise<boolean> {
    if (ready) return ready;
    engineState = 'loading';
    ready = new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        engineState = ok ? 'ready' : 'failed';
        if (!ok) worker?.terminate();
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), LOAD_TIMEOUT);
      try { worker = new Worker(ENGINE); } catch { done(false); return; }
      worker.onerror = () => done(false);
      worker.onmessage = (e: MessageEvent) => {
        const line = String(e.data);
        if (line === 'uciok') worker!.postMessage('isready');
        else if (line === 'readyok' && engineState === 'loading') done(true);
        else if (line.startsWith('bestmove')) {
          got++;
          // ответ на остановленный поиск (новая партия посреди раздумий) не считаем
          if (got === sent && onBest) { const cb = onBest; onBest = null; cb(line.split(' ')[1]); }
        }
      };
      worker.postMessage('uci');
    });
    return ready;
  }

  async function engineMove() {
    if (game.isGameOver() || game.turn() === side) return;
    const my = gen;
    thinking = true;
    render();
    const ok = await startEngine();
    if (my !== gen) return;
    if (!ok) { thinking = false; render(); return; }
    const t0 = performance.now();
    const { skill, time } = LEVELS[level];
    minLevel = Math.min(minLevel, level);
    const uci = await new Promise<string>((resolve) => {
      onBest = resolve;
      sent++;
      worker!.postMessage(`setoption name Skill Level value ${skill}`);
      worker!.postMessage(`position fen ${game.fen()}`);
      worker!.postMessage(`go movetime ${time}`);
    });
    const wait = reduced.matches ? 0 : MIN_THINK - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (my !== gen || !uci || uci === '(none)') return;
    thinking = false;
    const from = uci.slice(0, 2) as Square, to = uci.slice(2, 4) as Square;
    let move: Move | null = null;
    try { move = game.move({ from, to, promotion: uci[4] || undefined }); } catch { move = null; }
    if (!move) { render(); return; }
    afterMove(move, true);
  }

  function stopEngine() {
    gen++;
    onBest = null;
    if (thinking && worker) worker.postMessage('stop');
    thinking = false;
  }

  // ---------- доска ----------
  const cells = new Map<Square, HTMLButtonElement>();
  let built: Side | null = null;

  // поверх клеток: стрелки правой кнопкой (svg) и выбор фигуры при превращении
  const NS = 'http://www.w3.org/2000/svg';
  const arrowsSvg = document.createElementNS(NS, 'svg');
  arrowsSvg.setAttribute('class', 'arrows');
  arrowsSvg.setAttribute('viewBox', '0 0 8 8');
  arrowsSvg.setAttribute('aria-hidden', 'true');
  const promoBox = document.createElement('div');
  promoBox.className = 'promo';
  promoBox.setAttribute('role', 'group');
  promoBox.setAttribute('aria-label', 'Во что превратить пешку?');
  promoBox.hidden = true;

  function build() {
    if (built === side) return;
    built = side;
    board.textContent = '';
    cells.clear();
    board.append(arrowsSvg, promoBox);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const f = side === 'w' ? col : 7 - col, r = side === 'w' ? 7 - row : row;
      const sq = (FILES[f] + (r + 1)) as Square;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq' + ((f + r) % 2 === 0 ? ' dark' : '');
      b.dataset.sq = sq;
      cells.set(sq, b);
      board.append(b);
    }
  }

  function targets(from: Square | null): Move[] {
    return from ? game.moves({ square: from, verbose: true }) : [];
  }

  function locked(): boolean {
    return game.isGameOver() || game.turn() !== side || thinking || pendingPromo !== null;
  }

  function render() {
    build();
    const hist = game.history({ verbose: true });
    const last = hist[hist.length - 1];
    const moves = targets(sel);
    const checkSq = game.inCheck()
      ? (game.board().flat().find((p) => p && p.type === 'k' && p.color === game.turn())?.square ?? null)
      : null;
    for (const [sq, b] of cells) {
      const p = game.get(sq);
      const mv = moves.find((m) => m.to === sq);
      b.classList.toggle('last', !!last && (last.from === sq || last.to === sq));
      b.classList.toggle('check', sq === checkSq);
      b.classList.toggle('sel', sq === sel);
      b.classList.toggle('mark', marks.has(sq));
      b.classList.toggle('move', !!mv && !p && !mv.isEnPassant());
      b.classList.toggle('take', !!mv && (!!p || mv.isEnPassant()));
      const html = p ? pieceSvg(p.color, p.type) : '';
      if (b.dataset.pc !== (p ? p.color + p.type : '')) { b.innerHTML = html; b.dataset.pc = p ? p.color + p.type : ''; }
      let label = `${sq}${p ? ', ' + pieceLabel(p.color, p.type) : ''}`;
      if (sq === sel) label += ', выбрана';
      else if (mv) label += p || mv.isEnPassant() ? ', можно взять' : ', можно сходить';
      if (sq === checkSq) label += ', шах';
      b.setAttribute('aria-label', label);
      b.tabIndex = sq === focusSq ? 0 : -1;
    }
    renderStatus(last);
    renderPrize();
    renderScore(hist);
    renderArrows();
  }

  // съеденные фигуры: у каждого — то, что он взял; перевес — по материалу на доске (пешка 1, лёгкая 3, ладья 5, ферзь 9)
  function renderScore(hist: Move[]) {
    const taken: Record<Side, PieceType[]> = { w: [], b: [] };
    for (const m of hist) if (m.captured) taken[m.color].push(m.captured as PieceType);
    let material = 0;
    for (const p of game.board().flat()) if (p) material += (p.color === side ? 1 : -1) * VALUE[p.type];
    const bat: Side = side === 'w' ? 'b' : 'w';
    const fill = (el: HTMLElement, who: Side, adv: number) => {
      const list = taken[who].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const key = list.join('') + adv;
      if (el.dataset.key === key) return;
      el.dataset.key = key;
      const pcs = el.querySelector<HTMLElement>('.chess-taken')!, plus = el.querySelector<HTMLElement>('.chess-plus')!;
      // на чёрном подвале чёрная фигура не видна — все съеденные белыми силуэтами, чьи они, ясно по строке
      pcs.innerHTML = list.map((t) => pieceSvg('w', t, 'tk')).join('');
      plus.textContent = adv > 0 ? `+${adv}` : '';
      const names = list.length ? list.map((t) => NAMES[t]).join(', ') : 'ничего';
      el.setAttribute('aria-label', `${who === side ? 'Вы съели' : 'Bat съел'}: ${names}${adv > 0 ? `, перевес ${adv}` : ''}`);
    };
    fill(scoreYou, side, material);
    fill(scoreBat, bat, -material);
  }

  // ---------- стрелки и отметки правой кнопкой ----------
  const arrows = new Set<string>(); // «e2e4»
  const marks = new Set<Square>();
  const center = (sq: Square): [number, number] => {
    const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
    return side === 'w' ? [f + 0.5, 7 - r + 0.5] : [7 - f + 0.5, r + 0.5];
  };
  function renderArrows() {
    let html = '';
    for (const a of arrows) {
      const [x1, y1] = center(a.slice(0, 2) as Square), [x2, y2] = center(a.slice(2, 4) as Square);
      const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const sx = x1 + ux * 0.25, sy = y1 + uy * 0.25; // от края фигуры, а не из центра
      const hx = x2 - ux * 0.38, hy = y2 - uy * 0.38; // основание наконечника
      const w = 0.09, hw = 0.24;
      const px = -uy, py = ux;
      const pts = [
        [sx + px * w, sy + py * w], [hx + px * w, hy + py * w], [hx + px * hw, hy + py * hw],
        [x2 - ux * 0.08, y2 - uy * 0.08], [hx - px * hw, hy - py * hw], [hx - px * w, hy - py * w], [sx - px * w, sy - py * w],
      ];
      html += `<polygon points="${pts.map((p) => p.map((n) => n.toFixed(3)).join(',')).join(' ')}"/>`;
    }
    if (arrowsSvg.innerHTML !== html) arrowsSvg.innerHTML = html;
  }
  function clearMarks() {
    if (!arrows.size && !marks.size) return;
    arrows.clear();
    marks.clear();
  }

  function say(main: string, extra = '') {
    if (status.textContent !== main) status.textContent = main;
    if (sub.textContent !== extra) sub.textContent = extra;
  }

  function renderStatus(last?: Move) {
    if (engineState === 'failed') return say('Не получилось загрузить соперника', 'Попробуйте позже');
    if (game.isCheckmate()) {
      if (game.turn() === side) return say('Мат. Победил Bat', 'Сыграем ещё?');
      return say('Мат. Вы выиграли', `Ваша скидка — ${LEVELS[minLevel].off}%`);
    }
    if (game.isDraw()) {
      const why = game.isStalemate() ? 'Пат'
        : game.isThreefoldRepetition() ? 'Троекратное повторение'
        : game.isInsufficientMaterial() ? 'Не хватает фигур для мата' : 'Правило 50 ходов';
      return say('Ничья', why);
    }
    if (game.turn() !== side) {
      if (engineState !== 'ready') return say('Загружаем соперника…', last ? `Ваш ход: ${describe(last)}` : '');
      return say('Bat думает…', last ? `Ваш ход: ${describe(last)}` : '');
    }
    if (game.inCheck()) return say('Шах', 'Уведите короля или закройтесь');
    say('Ваш ход', last ? `Bat сходил: ${describe(last)}` : '');
  }

  // выигрыш: промокод один на партию, переживает перезагрузку
  function renderPrize() {
    const won = game.isCheckmate() && game.turn() !== side;
    if (won && !code) { code = makeCode(LEVELS[minLevel].off); save(); }
    prize.hidden = !won;
    if (won) codeEl.textContent = code;
  }

  // плавный ход: фигура встаёт на новую клетку и доезжает туда со старой (только transform)
  function slide(move: Move) {
    if (reduced.matches) return;
    const from = cells.get(move.from), to = cells.get(move.to);
    const pc = to?.querySelector<SVGElement>('.pc');
    if (!from || !to || !pc) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    pc.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
    pc.getBoundingClientRect();
    pc.classList.add('slide');
    pc.style.transform = '';
    pc.addEventListener('transitionend', () => pc.classList.remove('slide'), { once: true });
  }

  function afterMove(move: Move, animate: boolean) {
    sel = null;
    clearMarks();
    save();
    render();
    if (animate) slide(move);
    if (!game.isGameOver() && game.turn() !== side) engineMove();
  }

  function tryMove(from: Square, to: Square, animate: boolean): boolean {
    const legal = targets(from).filter((m) => m.to === to);
    if (!legal.length) return false;
    if (legal.some((m) => m.promotion)) { askPromotion(from, to); return true; }
    const move = game.move({ from, to });
    focusSq = to;
    afterMove(move, animate);
    return true;
  }

  // выбор фигуры встаёт прямо над пешкой: столбик из четырёх клеток от поля превращения к центру доски
  function askPromotion(from: Square, to: Square) {
    pendingPromo = { from, to };
    sel = null;
    promoBox.textContent = '';
    for (const t of PROMO) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', NAMES[t][0].toUpperCase() + NAMES[t].slice(1));
      b.innerHTML = pieceSvg(side, t);
      b.addEventListener('click', () => finishPromotion(t));
      promoBox.append(b);
    }
    const [x] = center(to);
    promoBox.style.left = `${(x - 0.5) * 12.5}%`;
    promoBox.hidden = false;
    board.classList.add('promoting');
    render();
    promoBox.querySelector('button')?.focus();
  }

  function finishPromotion(t: PieceType | null) {
    const p = pendingPromo;
    pendingPromo = null;
    promoBox.hidden = true;
    board.classList.remove('promoting');
    if (p && t) {
      const move = game.move({ from: p.from, to: p.to, promotion: t });
      focusSq = p.to;
      afterMove(move, true);
    } else render();
    cells.get(focusSq)?.focus();
  }

  function pick(sq: Square, animate: boolean) {
    if (locked()) return;
    if (sel && sel !== sq && tryMove(sel, sq, animate)) return;
    const p = game.get(sq);
    sel = p && p.color === side && sel !== sq ? sq : null;
    render();
  }

  // клавиатура и Enter/пробел: нажатие кнопки-клетки (detail = 0); мышь и палец — через pointer-события ниже
  board.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.sq');
    if (!b || e.detail !== 0) return;
    focusSq = b.dataset.sq as Square;
    pick(focusSq, true);
  });

  const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  board.addEventListener('keydown', (e) => {
    const d = ARROWS[e.key];
    if (!d) return;
    e.preventDefault();
    const list = [...cells.keys()];
    const i = list.indexOf(focusSq);
    const col = Math.min(7, Math.max(0, (i % 8) + d[0])), row = Math.min(7, Math.max(0, Math.floor(i / 8) + d[1]));
    focusSq = list[row * 8 + col];
    render();
    cells.get(focusSq)?.focus();
  });

  promoBox.addEventListener('keydown', (e) => {
    const list = [...promoBox.querySelectorAll('button')];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
    }
  });

  // правая кнопка: протянуть — стрелка, нажать на клетку — отметка; повтор убирает; левая кнопка всё стирает
  let rDown: Square | null = null;
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  const sqAt = (e: PointerEvent) => {
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>('.sq');
    return over && board.contains(over) ? (over.dataset.sq as Square) : null;
  };

  let drag: { from: Square; x: number; y: number; pc: SVGElement | null; moved: boolean; id: number } | null = null;
  board.addEventListener('pointerdown', (e) => {
    if (e.button === 2) { rDown = sqAt(e); return; }
    if (e.button !== 0) return;
    if (pendingPromo) { if (!promoBox.contains(e.target as Node)) finishPromotion(null); return; }
    if (arrows.size || marks.size) { clearMarks(); renderArrows(); render(); }
    const b = (e.target as Element).closest<HTMLButtonElement>('.sq');
    if (!b) return;
    const sq = b.dataset.sq as Square;
    const p = game.get(sq);
    drag = { from: sq, x: e.clientX, y: e.clientY, pc: p && p.color === side && !locked() ? b.querySelector('.pc') : null, moved: false, id: e.pointerId };
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !drag.pc) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG) return;
    if (!drag.moved) {
      drag.moved = true;
      sel = drag.from;
      render();
      drag.pc = cells.get(drag.from)?.querySelector('.pc') ?? null;
      drag.pc?.classList.add('drag');
    }
    if (drag.pc) drag.pc.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endDrag = (e: PointerEvent, cancel: boolean) => {
    if (e.button === 2 && rDown) {
      const to = sqAt(e), from = rDown;
      rDown = null;
      if (!to || cancel) return;
      if (to === from) { if (!marks.delete(from)) marks.add(from); } else {
        const key = from + to;
        if (!arrows.delete(key)) arrows.add(key);
      }
      render();
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.pc) { d.pc.style.transform = ''; d.pc.classList.remove('drag'); }
    if (cancel) { render(); return; }
    const to = sqAt(e);
    if (d.moved) {
      if (!to || to === d.from || !tryMove(d.from, to, false)) render();
      return;
    }
    if (to) { focusSq = to; pick(to, true); }
  };
  board.addEventListener('pointerup', (e) => endDrag(e, false));
  board.addEventListener('pointercancel', (e) => endDrag(e, true));

  // ---------- управление ----------
  function newGame() {
    stopEngine();
    game.reset();
    sel = null;
    minLevel = level;
    code = '';
    clearMarks();
    if (pendingPromo) { pendingPromo = null; promoBox.hidden = true; board.classList.remove('promoting'); }
    focusSq = side === 'w' ? 'e2' : 'e7';
    save();
    render();
    if (side === 'b') engineMove();
  }

  levels.forEach((i) => i.addEventListener('change', () => {
    level = +i.value;
    // до первого хода Bat уровень можно менять свободно
    if (!game.history().some((_, n) => (n % 2 === 0) !== (side === 'w'))) minLevel = level;
    save();
  }));
  sides.forEach((i) => i.addEventListener('change', () => { side = i.value as Side; newGame(); }));
  root.querySelector('[data-chess-new]')!.addEventListener('click', newGame);
  root.querySelector('[data-chess-close]')!.addEventListener('click', () => toggle(false));
  // промокод — в поле «Опишите задачу» брифа, подвал закрывается, фокус в поле
  root.querySelector('[data-chess-use]')!.addEventListener('click', () => {
    const task = document.querySelector<HTMLTextAreaElement>('#bf-task');
    toggle(false, false);
    if (!task) return;
    const line = `Промокод на скидку: ${code}`;
    if (!task.value.includes(code)) task.value = task.value ? `${task.value.trimEnd()}\n${line}` : line;
    task.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('zayavka')?.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
    task.focus({ preventScroll: true });
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (pendingPromo) finishPromotion(null); else toggle(false);
  });
  addEventListener('themechange', () => { if (open && document.documentElement.dataset.theme === 'term') toggle(false); });

  // подвал не меняет высоту; экран сдвигается, только если игра не видна. На телефоне игра выше экрана — поднимаем
  // ровно настолько, чтобы заголовок встал под шапку (при прокрутке вверх шапка телефона появляется)
  function reveal() {
    const behavior: ScrollBehavior = reduced.matches ? 'auto' : 'smooth';
    if (!phone.matches) { board.scrollIntoView({ block: 'nearest', behavior }); return; }
    // на главной шапка телефона — .hero-bar, на остальных страницах — [data-hdr]
    const bars = [...document.querySelectorAll<HTMLElement>('[data-hdr], .hero-bar')].map((el) => el.getBoundingClientRect().height);
    const hdr = Math.max(0, ...bars.filter((h) => h < innerHeight / 3));
    const top = title.getBoundingClientRect().top - hdr - 16;
    if (top < 0) scrollBy({ top, behavior });
  }

  // фокус переносим только тем, кто управляет с клавиатуры: мобильный Safari прокручивает к элементу при focus()
  // даже с preventScroll, и игра уезжала под шапку (Batın 2026-10-24, телефон)
  let keyboard = btn.matches(':focus-visible'); // первое открытие: слушатели ниже ставятся уже после нажатия
  addEventListener('keydown', () => (keyboard = true), true);
  addEventListener('pointerdown', () => (keyboard = false), true);

  function toggle(want = !open, refocus = true) {
    if (want === open) return;
    open = want;
    root.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (ftIn) ftIn.inert = open;
    document.documentElement.toggleAttribute('data-chess-open', open);
    document.dispatchEvent(new Event('chess-change'));
    if (open) {
      render();
      if (keyboard) title.focus({ preventScroll: true });
      reveal();
      startEngine().then(() => render());
      if (game.turn() !== side && !thinking) engineMove();
    } else {
      if (pendingPromo) finishPromotion(null);
      stopEngine();
      render();
      if (refocus && keyboard) btn.focus({ preventScroll: true });
    }
  }

  return { toggle };
}
