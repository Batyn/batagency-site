// Глаз в логотипе (из prototypes/prototype-a5.html ← brand/logo/bat-blink.html): сам моргает и оглядывается (SMIL в SVG),
// над первым экраном следит за курсором или пальцем, по нажатию моргает. При reduced-motion неподвижен.
const svg = document.getElementById('logo') as unknown as SVGSVGElement | null;
const hero = document.getElementById('top');

// при reduced-motion глаз неподвижен на всех страницах; слежение за курсором — только над первым экраном главной
if (svg) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) svg.pauseAnimations();
  else if (hero) init(svg, hero);
}

function init(svg: SVGSVGElement, hero: HTMLElement) {
  const $ = <T extends Element>(id: string) => document.getElementById(id) as unknown as T;
  const gaze = $<SVGGElement>('gaze');
  const searchAnim = $<SVGAnimationElement>('search-anim');
  const lid = $<SVGPathElement>('lid');
  const lidAnim = $<SVGAnimationElement>('lid-anim');
  const blinkLoop = $<SVGAnimationElement>('blink-loop');
  const blinkOnce = () => $<SVGAnimationElement>('blink-once').beginElement();

  const CX = +gaze.dataset.cx!, CY = +gaze.dataset.cy!;
  const UX = +gaze.dataset.ux!, UY = +gaze.dataset.uy!, VX = -UY, VY = UX;
  const RANGE_ALONG = 27, RANGE_ACROSS = 8, REACH = 140, REACH_ACROSS = 90, OMEGA = 6;

  const bezier = ([x1, y1, x2, y2]: number[], x: number) => {
    let lo = 0, hi = 1, s = x;
    for (let n = 0; n < 30; n++) {
      s = (lo + hi) / 2;
      const bx = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3;
      if (bx < x) lo = s; else hi = s;
    }
    return 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
  };
  const nums = (s: string) => s.trim().split(/[\s,]+/).map(Number);
  // где сейчас взгляд в цикле «осматривается» — чтобы слежение началось с того же места
  function searchOffset(): number[] {
    let t: number;
    try { t = svg.getCurrentTime() - searchAnim.getStartTime(); } catch { return [0, 0]; }
    const dur = searchAnim.getSimpleDuration(), f = (t % dur) / dur;
    const times = nums(searchAnim.getAttribute('keyTimes')!.replace(/;/g, ' '));
    const vals = searchAnim.getAttribute('values')!.split(';').map(nums);
    const spl = searchAnim.getAttribute('keySplines')!.split(';').map(nums);
    let i = times.findIndex((k, j) => j < times.length - 1 && f >= k && f <= times[j + 1]);
    if (i < 0) i = times.length - 2;
    const e = bezier(spl[i], (f - times[i]) / (times[i + 1] - times[i] || 1));
    return [0, 1].map((k) => vals[i][k] + (vals[i + 1][k] - vals[i][k]) * e);
  }

  let pointer: { x: number; y: number } | null = null;
  function aim(): number[] | null {
    const m = svg.getScreenCTM();
    if (!pointer || !m) return null;
    const p = new DOMPoint(pointer.x, pointer.y).matrixTransform(m.inverse());
    const dx = p.x - CX, dy = p.y - CY;
    const a = RANGE_ALONG * Math.tanh((dx * UX + dy * UY) / REACH);
    const q = RANGE_ACROSS * Math.tanh((dx * VX + dy * VY) / REACH_ACROSS);
    return [a * UX + q * VX, a * UY + q * VY];
  }

  // слежение — пружина (ω = 6), чтобы взгляд догонял курсор мягко и прерывался без рывков
  let mode: 'search' | 'follow' | 'return' = 'search';
  let pos = [0, 0], vel = [0, 0], target = [0, 0], raf = 0, last = 0;
  const NUM = /-?\d+\.?\d*/g;
  const lidOpen = lid.getAttribute('d')!, lidDown = lid.getAttribute('data-down')!;
  const a0 = lidOpen.match(NUM)!.map(Number), a1 = lidDown.match(NUM)!.map(Number);
  const setLid = (f: number) => { let i = 0; lid.setAttribute('d', lidOpen.replace(NUM, () => { const v = a0[i] + (a1[i] - a0[i]) * f; i++; return v.toFixed(2); })); };
  const droop = (q: number) => { const t = Math.max(0, Math.min(1, q / 6)); return t * t * (3 - 2 * t); };
  const place = () => { gaze.setAttribute('transform', `translate(${pos[0].toFixed(2)} ${pos[1].toFixed(2)})`); setLid(droop(pos[0] * VX + pos[1] * VY)); };

  function tick(now: number) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode === 'follow') target = aim() || target;
    for (; dt > 0; dt -= 1 / 120) {
      const h = Math.min(dt, 1 / 120);
      for (const i of [0, 1]) { vel[i] += (OMEGA * OMEGA * (target[i] - pos[i]) - 2 * OMEGA * vel[i]) * h; pos[i] += vel[i] * h; }
    }
    place();
    if (mode === 'return' && Math.hypot(pos[0], pos[1]) < 0.15 && Math.hypot(vel[0], vel[1]) < 0.5) {
      gaze.removeAttribute('transform'); lid.setAttribute('d', lidOpen);
      searchAnim.beginElement(); lidAnim.beginElement(); blinkLoop.beginElement();
      mode = 'search'; raf = 0; return;
    }
    raf = requestAnimationFrame(tick);
  }
  function startFollow() {
    if (mode === 'search') { pos = searchOffset(); vel = [0, 0]; target = pos.slice(); place(); searchAnim.endElement(); lidAnim.endElement(); blinkOnce(); }
    mode = 'follow';
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function stopFollow() { if (mode === 'follow') { mode = 'return'; target = [0, 0]; } }

  let idle = 0;
  const wake = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
    startFollow();
    clearTimeout(idle);
    idle = window.setTimeout(stopFollow, e.pointerType === 'mouse' ? 4000 : 1500);
  };
  hero.addEventListener('pointermove', wake);
  hero.addEventListener('pointerdown', wake);
  hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { clearTimeout(idle); stopFollow(); } });
  for (const id of ['letter-a', 'eye-white', 'gaze']) document.getElementById(id)?.addEventListener('click', (e) => { e.preventDefault(); blinkOnce(); });
  // глаз ушёл с экрана — не тратим кадры
  new IntersectionObserver(([en]) => { if (en.isIntersecting) svg.unpauseAnimations(); else svg.pauseAnimations(); }).observe(svg);
}
