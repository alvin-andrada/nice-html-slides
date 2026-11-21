// Default 2D charts: SVG drawn inside the [data-chart] element, animated with GSAP.
import { gsap } from 'gsap';

const NS = 'http://www.w3.org/2000/svg';

function node(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function text(parent, x, y, str, cls, anchor = 'middle') {
  const t = node('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'middle', class: cls }, parent);
  t.textContent = str;
  return t;
}

// axis range rounded outward to a 1/2/5 step so every value sits inside it
function niceDomain(vals, n = 4) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}

function build(el, col, points) {
  const w = el.clientWidth, h = el.clientHeight, type = el.dataset.chart;
  const raw = (el.dataset.values || '').split(',').filter(Boolean).map(v => v.trim());
  const vals = raw.map(Number);
  const cols = (el.dataset.colors || '#1d2b4f').split(',').map(c => col(c.trim()));
  const min = +(el.dataset.min || 0), max = +(el.dataset.max || Math.max(...vals));
  const fmt = el.dataset.format || '{v}', showV = el.dataset.labels === 'values';
  const OFF = el.dataset.off || '#ff6b6b', EMPTY = el.dataset.empty || '#dbe6f3';
  const svg = node('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'chart2d' });
  const c = { svg, type, marks: [], labels: [], tops: [], anim: [] };

  if (type === 'bars') {
    const slot = w / vals.length, bw = slot * 0.6;
    node('line', { x1: 0, x2: w, y1: h, y2: h, class: 'base' }, svg);
    vals.forEach((v, i) => {
      const bh = Math.max(4, (h * (v - min)) / (max - min)), x = slot * (i + 0.5) - bw / 2;
      const r = node('rect', { x, y: h, width: bw, height: 0, rx: 16, fill: cols[i % cols.length] }, svg);
      c.anim.push([r, { y: h, height: 0 }, { y: h - bh, height: bh }]);
      c.tops.push([slot * (i + 0.5), h - bh]);
      if (showV) c.labels.push(text(svg, slot * (i + 0.5), h - bh + Math.min(56, bh / 2), fmt.replace('{v}', raw[i]), 'v in'));
    });
  } else if (type === 'hbars') {
    const slot = h / vals.length, bt = slot * 0.5;
    vals.forEach((v, i) => {
      const len = Math.max(4, (w * 0.86 * (v - min)) / (max - min)), y = slot * (i + 0.5);
      const r = node('rect', { x: 0, y: y - bt / 2, width: 0, height: bt, rx: 14, fill: cols[i % cols.length] }, svg);
      c.anim.push([r, { width: 0 }, { width: len }]);
      if (showV) c.labels.push(text(svg, len + 16, y, fmt.replace('{v}', raw[i]), 'v', 'start'));
    });
  } else if (type === 'matrix') {
    const S = Math.min(w, h), cell = S / 3, ox = (w - S) / 2, gap = 10;
    vals.forEach((v, i) => {
      const rr = Math.floor(i / 3), cc = i % 3, x = ox + cc * cell, y = rr * cell;
      const fill = rr === cc ? cols[rr % cols.length] : v > 0 ? OFF : EMPTY;
      const g = node('g', {}, svg);
      node('rect', { x: x + gap / 2, y: y + gap / 2, width: cell - gap, height: cell - gap, rx: 22, fill }, g);
      text(g, x + cell / 2, y + cell / 2, raw[i], v ? 'v in big' : 'v zero big');
      c.marks.push(g);
    });
  } else if (type === 'scatter') {
    const r = 7, pad = r + 6, pl = 110, pb = 96, pt = 24, pw = w - pl, ph = h - pb;
    const [xa, ya] = (el.dataset.axes || 'x,y').split(',');
    const [xk, yk] = (el.dataset.keys || 'bill,flipper').split(',').map(k => k.trim());
    const xd = niceDomain(points.map(p => p[xk])), yd = niceDomain(points.map(p => p[yk]));
    // marks are inset from the axes by their radius so edge points never cross them
    const sx = v => pl + pad + ((v - xd.lo) / (xd.hi - xd.lo)) * (pw - 2 * pad);
    const sy = v => ph - pad - ((v - yd.lo) / (yd.hi - yd.lo)) * (ph - pt - 2 * pad);
    node('rect', { x: pl, y: pt, width: pw, height: ph - pt, fill: 'none', class: 'plot-area' }, svg);
    const ax = node('g', { class: 'axis' }, svg);
    node('line', { x1: pl, x2: w, y1: ph, y2: ph }, ax);
    node('line', { x1: pl, x2: pl, y1: pt, y2: ph }, ax);
    xd.ticks.forEach(v => text(ax, sx(v), ph + 34, v, 'tick'));
    yd.ticks.forEach(v => text(ax, pl - 14, sy(v), v, 'tick', 'end'));
    text(ax, pl + pw / 2, h - 10, `${xa.trim()} (mm)`, 'title');
    const yt = text(ax, 0, 0, `${ya.trim()} (mm)`, 'title');
    yt.setAttribute('transform', `translate(22 ${(pt + ph) / 2}) rotate(-90)`);
    points.forEach(p => {
      c.marks.push(node('circle', { cx: sx(p[xk]), cy: sy(p[yk]), r, fill: col(p.species), 'fill-opacity': 0.85 }, svg));
    });
  }
  el.appendChild(svg);
  // labels inside bars shrink to fit the bar instead of spilling over its edges
  if (type === 'bars') {
    const bw = (w / vals.length) * 0.6 - 16;
    c.labels.forEach(t => {
      const lw = t.getBBox().width;
      if (lw > bw) t.style.fontSize = Math.floor(parseFloat(getComputedStyle(t).fontSize) * bw / lw) + 'px';
    });
  }
  return c;
}

export function show2d(el, d, col, points) {
  const c = el._c2d || (el._c2d = build(el, col, points));
  const all = [...c.anim.map(a => a[0]), ...c.marks, ...c.labels];
  if (all.length) gsap.killTweensOf(all);
  c.anim.forEach(([r, from, to], i) => {
    if (d) gsap.fromTo(r, { attr: from }, { attr: to, duration: 0.9, delay: 0.25 + i * 0.08, ease: 'power3.out' });
    else gsap.set(r, { attr: to });
  });
  if (d) {
    if (c.marks.length) gsap.fromTo(c.marks, { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: { amount: c.type === 'scatter' ? 1 : 0.4 }, delay: 0.25 });
    if (c.labels.length) gsap.fromTo(c.labels, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.9 });
  } else {
    if (c.marks.length) gsap.set(c.marks, { opacity: 1, scale: 1 });
    if (c.labels.length) gsap.set(c.labels, { opacity: 1 });
  }
  return c.tops;
}
