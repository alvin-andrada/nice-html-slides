// 3D accent layer for fixed-stage HTML decks.
// Slides stay plain HTML; elements with data-penguin / data-chart act as anchors for 3D objects.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SphereGeometry, ConeGeometry, TorusGeometry,
  BoxGeometry, CircleGeometry, MeshToonMaterial, MeshBasicMaterial, DataTexture, RedFormat, NearestFilter,
  HemisphereLight, DirectionalLight, Vector2, Vector3, Plane, Raycaster, Color, InstancedMesh, Object3D,
  BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, CanvasTexture, Clock, Box3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { show2d } from './charts2d.js';
import { makeProps } from './props.js';

gsap.registerPlugin(SplitText);
export { gsap, SplitText };

const W = 1920, H = 1080, PH = 2.1;
export const SPECIES = { adelie: '#ff8a1f', chinstrap: '#9b5de5', gentoo: '#12a4a4' };
const INK = '#1d2b4f';
const THEME = { body: '#24304f' };
const noOutline = m => { m.userData.outlineParameters = { visible: false }; return m; };

const ramp = (() => {
  const t = new DataTexture(new Uint8Array([110, 190, 255]), 3, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = c => new MeshToonMaterial({ color: new Color(c), gradientMap: ramp });
const sphere = new SphereGeometry(1, 32, 24);

function part(geo, mat, parent, pos, scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  parent.add(m);
  return m;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(29,43,79,0.35)');
  grad.addColorStop(1, 'rgba(29,43,79,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
const shadowMat = noOutline(new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));

function makePenguin(kind) {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const black = toon(THEME.body), white = toon('#ffffff'), pink = toon('#ff9eb5');
  const beakMat = toon(kind === 'gentoo' ? '#ff7a1a' : '#3b3f4a');
  const feetMat = toon(kind === 'gentoo' ? '#ff8c2a' : '#f4a6a0');

  part(sphere, black, body, [0, 1.0, 0], [0.82, 1, 0.78]);
  part(sphere, white, body, [0, 0.86, 0.34], [0.62, 0.76, 0.5]);
  if (kind === 'chinstrap') {
    part(sphere, white, body, [0, 1.42, 0.36], [0.6, 0.44, 0.42]);
    part(new TorusGeometry(0.42, 0.028, 8, 40, Math.PI), black, body, [0, 1.36, 0.62], [1, 0.75, 1], [0.15, 0, Math.PI]);
  }
  if (kind === 'gentoo') {
    part(sphere, white, body, [0, 1.8, 0.4], [0.5, 0.1, 0.26], [0.5, 0, 0]);
  }
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new Group();
    eye.position.set(sx * 0.26, 1.46, 0.64);
    body.add(eye);
    part(sphere, white, eye, [0, 0, 0], [0.16, 0.17, 0.08]);
    part(sphere, toon('#141a2e'), eye, [0, -0.01, 0.05], [0.1, 0.11, 0.06]);
    part(sphere, noOutline(new MeshBasicMaterial({ color: '#ffffff' })), eye, [0.03, 0.04, 0.1], [0.032, 0.032, 0.02]);
    eyes.push(eye);
    part(sphere, pink, body, [sx * 0.44, 1.24, 0.58], [0.11, 0.07, 0.04], [0, sx * 0.6, 0]);
  }
  part(new ConeGeometry(0.09, 0.26, 16), beakMat, body, [0, 1.3, 0.84], [1, 1, 1], [Math.PI / 2, 0, 0]);

  const scarf = toon(SPECIES[kind]);
  part(new TorusGeometry(0.7, 0.11, 12, 40), scarf, body, [0, 1.12, 0], [1.17, 1.12, 1], [Math.PI / 2, 0, 0]);
  part(new BoxGeometry(0.2, 0.42, 0.07), scarf, body, [0.34, 0.86, 0.74], [1, 1, 1], [0.1, 0, 0.22]);

  const flippers = [];
  for (const sx of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(sx * 0.74, 1.25, 0);
    body.add(pivot);
    part(sphere, black, pivot, [0, -0.45, 0], [0.12, 0.52, 0.3], [0, 0, sx * 0.2]);
    flippers.push(pivot);
  }
  for (const sx of [-1, 1]) part(sphere, feetMat, root, [sx * 0.3, 0.06, 0.38], [0.24, 0.08, 0.32]);
  const shadow = part(new CircleGeometry(1, 32), shadowMat, root, [0, 0.01, 0.1], [1.05, 0.8, 1], [-Math.PI / 2, 0, 0]);

  const size = new Box3().setFromObject(root).getSize(new Vector3());
  root.visible = false;
  root.scale.setScalar(0.001);
  return { size, kind, root, body, eyes, flL: flippers[0], flR: flippers[1], shadow, act: 'idle', moving: false, phase: Math.random() * 6 };
}

function mockPenguins() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const norm = (m, s) => m + s * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const spec = {
    adelie: [146, [38.8, 2.7], [190, 6.5], [3706, 458]],
    chinstrap: [68, [48.8, 3.3], [196, 7.1], [3733, 384]],
    gentoo: [119, [47.6, 3.1], [217, 6.5], [5092, 501]],
  };
  const pts = [];
  for (const [species, [n, b, f, m]] of Object.entries(spec)) {
    for (let i = 0; i < n; i++) pts.push({ species, bill: norm(...b), flipper: norm(...f), mass: norm(...m) });
  }
  return pts;
}

export function init(stageEl) {
  // the slide style owns the look: species colours, body colour and outline come from CSS variables
  const css = getComputedStyle(stageEl);
  const v = (n, d) => css.getPropertyValue(n).trim() || d;
  for (const k of Object.keys(SPECIES)) SPECIES[k] = v(`--s3d-${k}`, SPECIES[k]);
  THEME.body = v('--s3d-body', THEME.body);
  const outline = v('--s3d-outline', '');
  const canvas = document.createElement('canvas');
  canvas.className = 'stage3d-canvas';
  stageEl.prepend(canvas);
  const layer = document.createElement('div');
  layer.className = 'stage3d-labels';
  stageEl.appendChild(layer);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H, false);
  const effect = outline ? new OutlineEffect(renderer, { defaultThickness: +v('--s3d-outline-width', '0.005'), defaultColor: new Color(outline).toArray(), defaultAlpha: 1 }) : null;
  const scene = new Scene();
  const camera = new PerspectiveCamera(26, W / H, 0.1, 200);
  camera.position.set(0, 4, 24);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  scene.add(new HemisphereLight('#ffffff', '#bcd7f0', 1.5));
  const sun = new DirectionalLight('#ffffff', 1.7);
  sun.position.set(4, 7, 9);
  scene.add(sun);

  const ray = new Raycaster(), zPlane = new Plane(new Vector3(0, 0, 1), 0), ndc = new Vector2();
  // stage pixel -> point on the plane z = depth, so objects on different depth layers still land on their anchors
  const px2w = (x, y, depth = 0) => {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    zPlane.constant = -depth;
    const p = new Vector3();
    ray.ray.intersectPlane(zPlane, p);
    return p;
  };
  const w2px = v => {
    const p = v.clone().project(camera);
    return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H];
  };
  // layout position in stage pixels, ignoring transforms, so anchors read where things settle rather than mid-animation
  const rectOf = el => {
    let x = 0, y = 0;
    for (let e = el; e && e !== stageEl; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight };
  };
  const col = c => SPECIES[c] || c;

  const penguins = {};
  for (const k of Object.keys(SPECIES)) {
    penguins[k] = makePenguin(k);
    scene.add(penguins[k].root);
    const q = document.createElement('div');
    q.className = 'l3d l3d-top l3d-q';
    q.textContent = '?';
    q.style.opacity = 0;
    layer.appendChild(q);
    penguins[k].q = q;
  }

  const charts = new Group();
  scene.add(charts);
  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 4, 0.06);
  const blocks = Array.from({ length: 9 }, () => {
    const m = new Mesh(blockGeo, toon('#cccccc'));
    m.visible = false;
    m.scale.setScalar(0.001);
    charts.add(m);
    return m;
  });

  const points = mockPenguins();
  const sc = { grow: 0 };
  const pivot = new Group();
  pivot.visible = false;
  charts.add(pivot);
  const dots = new InstancedMesh(new SphereGeometry(1, 12, 8), toon('#ffffff'), points.length);
  const norm01 = (v, a, b) => (v - a) / (b - a) - 0.5;
  const dotPos = points.map(p => new Vector3(norm01(p.bill, 32, 60), norm01(p.flipper, 170, 235), norm01(p.mass, 2600, 6400)));
  points.forEach((p, i) => dots.setColorAt(i, new Color(SPECIES[p.species])));
  pivot.add(dots);
  const axisGeo = new BufferGeometry();
  const o = -0.5;
  const seg = [[o, o, o, 0.5, o, o], [o, o, o, o, 0.5, o], [o, o, o, o, o, 0.5]];
  for (let i = -0.25; i <= 0.5; i += 0.25) seg.push([i, o, o, i, o, 0.5], [o, o, i, 0.5, o, i]);
  axisGeo.setAttribute('position', new Float32BufferAttribute(seg.flat(), 3));
  pivot.add(new LineSegments(axisGeo, new LineBasicMaterial({ color: INK, transparent: true, opacity: 0.35 })));
  const dummy = new Object3D();

  let labels = [];
  function setLabels(list, d) {
    labels.forEach(l => gsap.to(l.el, { opacity: 0, duration: 0.2, onComplete: () => l.el.remove() }));
    labels = list.map(l => {
      const el = document.createElement('div');
      el.className = `l3d l3d-${l.at} ${l.cls || ''}`;
      el.textContent = l.text;
      el.style.opacity = 0;
      layer.appendChild(el);
      gsap.to(el, { opacity: 1, duration: 0.4, delay: d ? d * 0.9 : 0 });
      return { el, get: l.get };
    });
  }

  function layoutChart(el) {
    const r = rectOf(el), type = el.dataset.chart;
    const raw = (el.dataset.values || '').split(',').filter(Boolean).map(v => v.trim());
    const vals = raw.map(Number);
    const cols = (el.dataset.colors || INK).split(',').map(c => col(c.trim()));
    const bl = px2w(r.l, r.b), br = px2w(r.r, r.b), tl = px2w(r.l, r.t);
    const Wd = br.x - bl.x, Hd = tl.y - bl.y;
    const min = +(el.dataset.min || 0), max = +(el.dataset.max || Math.max(...vals));
    const fmt = el.dataset.format || '{v}', showV = el.dataset.labels === 'values';
    const out = { type, blocks: [], labels: [] };
    const label = (i, at, v) => {
      const off = { inside: b => new Vector3(b.position.x, b.position.y + b.scale.y / 2 - 0.32, b.position.z + b.scale.z / 2 + 0.02),
        end: b => new Vector3(b.position.x + b.scale.x / 2 + 0.15, b.position.y, b.position.z + b.scale.z / 2),
        front: b => new Vector3(b.position.x, b.position.y, b.position.z + b.scale.z / 2 + 0.02) }[at];
      out.labels.push({ text: fmt.replace('{v}', v), at, cls: +v === 0 ? 'l3d-zero' : '', get: () => off(blocks[i]) });
    };
    if (type === 'bars') {
      const slot = Wd / vals.length, bw = slot * 0.5, dep = Math.min(bw, 1.4);
      vals.forEach((v, i) => {
        const h = Math.max(0.05, (Hd * (v - min)) / (max - min));
        out.blocks.push({ x: bl.x + slot * (i + 0.5), y: bl.y + h / 2, z: 0, sx: bw, sy: h, sz: dep, color: cols[i % cols.length], axis: 'y', edge: bl.y });
        if (showV) label(i, 'inside', raw[i]);
      });
    } else if (type === 'hbars') {
      const slot = Hd / vals.length, bt = slot * 0.5;
      vals.forEach((v, i) => {
        const len = Math.max(0.05, (Wd * 0.86 * (v - min)) / (max - min));
        out.blocks.push({ x: bl.x + len / 2, y: tl.y - slot * (i + 0.5), z: 0, sx: len, sy: bt, sz: Math.min(bt, 0.9), color: cols[i % cols.length], axis: 'x', edge: bl.x });
        if (showV) label(i, 'end', raw[i]);
      });
    } else if (type === 'matrix') {
      const S = Math.min(Wd, Hd), cell = S / 3, ox = bl.x + (Wd - S) / 2, top = tl.y - (Hd - S) / 2, mx = Math.max(...vals);
      vals.forEach((v, i) => {
        const rr = Math.floor(i / 3), cc = i % 3, dep = 0.12 + (v / mx) * S * 0.18;
        const color = rr === cc ? cols[rr % cols.length] : v > 0 ? '#ff6b6b' : '#dbe6f3';
        out.blocks.push({ x: ox + cell * (cc + 0.5), y: top - cell * (rr + 0.5), z: dep / 2, sx: cell * 0.86, sy: cell * 0.86, sz: dep, color, axis: 'z', edge: 0 });
        label(i, 'front', raw[i]);
      });
    } else if (type === 'scatter') {
      out.center = px2w((r.l + r.r) / 2, (r.t + r.b) / 2);
      out.size = Hd * 0.62;
      const names = (el.dataset.axes || 'x,y,z').split(',');
      [[0.62, o, o], [o, 0.6, o], [o, o, 0.68]].forEach((p, i) => {
        out.labels.push({ text: names[i], at: 'axis', get: () => pivot.localToWorld(new Vector3(...p)) });
      });
    }
    out.tops = out.blocks.map(b => new Vector3(b.x, b.y + b.sy / 2, 0));
    return out;
  }

  function applyBlocks(targets, d) {
    blocks.forEach((m, i) => {
      const tg = targets[i];
      gsap.killTweensOf([m.position, m.scale, m.material.color]);
      if (!tg) {
        if (m.visible) gsap.to(m.scale, { x: 0.001, y: 0.001, z: 0.001, duration: d * 0.5, onComplete: () => { m.visible = false; } });
        return;
      }
      if (!m.visible) {
        m.visible = true;
        m.position.set(tg.x, tg.y, tg.z);
        m.position[tg.axis] = tg.edge;
        m.scale.set(tg.sx, tg.sy, tg.sz);
        m.scale[tg.axis] = 0.001;
        m.material.color.set(tg.color);
      }
      const c = new Color(tg.color), delay = i * 0.05 * d;
      gsap.to(m.position, { x: tg.x, y: tg.y, z: tg.z, duration: d, delay, ease: 'power3.inOut' });
      gsap.to(m.scale, { x: tg.sx, y: tg.sy, z: tg.sz, duration: d, delay, ease: 'power3.inOut' });
      gsap.to(m.material.color, { r: c.r, g: c.g, b: c.b, duration: d });
    });
  }

  function setScatter(chart, d) {
    gsap.killTweensOf(sc);
    if (chart) {
      const fresh = !pivot.visible;
      pivot.visible = true;
      if (fresh || !d) { pivot.position.copy(chart.center); pivot.scale.setScalar(chart.size); }
      else {
        gsap.to(pivot.position, { x: chart.center.x, y: chart.center.y, z: chart.center.z, duration: d });
        gsap.to(pivot.scale, { x: chart.size, y: chart.size, z: chart.size, duration: d });
      }
      gsap.to(sc, { grow: 1, duration: d ? 1.6 : 0, delay: d * 0.3, ease: 'power2.out' });
    } else if (pivot.visible) {
      gsap.to(sc, { grow: 0, duration: d * 0.6, onComplete: () => { pivot.visible = false; } });
    }
  }

  function placePenguin(p, a, chart, d) {
    const R = p.root;
    gsap.killTweensOf([R.position, R.rotation, R.scale]);
    if (!a) {
      p.moving = false;
      if (R.visible) gsap.to(R.scale, { x: 0.001, y: 0.001, z: 0.001, duration: d * 0.45, ease: 'back.in(2)', onComplete: () => { R.visible = false; } });
      return;
    }
    const r = rectOf(a), cx = (r.l + r.r) / 2, z = +(a.dataset.z || 0);
    const foot = px2w(cx, r.b, z);
    let s = (px2w(cx, r.t, z).y - foot.y) / PH;
    if (r.r - r.l > 20) s = Math.min(s, (px2w(r.r, r.b, z).x - px2w(r.l, r.b, z).x) / p.size.x);
    let target = foot;
    const on = a.dataset.on != null ? chart?.tops?.[+a.dataset.on] : null;
    if (on) target = on.clone();
    p.act = a.dataset.act || 'idle';
    const face = ((+a.dataset.face || 0) * Math.PI) / 180;
    if (!R.visible || !d) {
      R.visible = true;
      R.position.copy(target);
      R.rotation.y = face;
      p.moving = false;
      if (!d) R.scale.setScalar(s);
      else {
        R.scale.setScalar(0.001);
        gsap.to(R.scale, { x: s, y: s, z: s, duration: 0.7, delay: on ? 1.0 : 0.35, ease: 'back.out(2)' });
      }
      return;
    }
    gsap.to(R.scale, { x: s, y: s, z: s, duration: d });
    const dist = R.position.distanceTo(target);
    if (dist < 0.05) { p.moving = false; gsap.to(R.rotation, { y: face, duration: 0.5 }); return; }
    const dur = Math.min(1.8, 0.6 + dist * 0.16), y0 = R.position.y;
    p.moving = true;
    gsap.to(R.rotation, { y: (Math.sign(target.x - R.position.x) || 1) * 0.9, duration: 0.25 });
    gsap.to(R.position, { x: target.x, z: target.z, duration: dur, ease: 'power1.inOut',
      onComplete: () => { p.moving = false; gsap.to(R.rotation, { y: face, duration: 0.4 }); } });
    if (Math.abs(target.y - y0) > 0.1) gsap.to(R.position, { keyframes: { y: [y0, Math.max(y0, target.y) + s * 0.9, target.y] }, duration: dur, ease: 'none' });
    else gsap.to(R.position, { y: target.y, duration: dur });
  }

  const api = { freeze: false, layers: { charts: true }, points, SPECIES };
  const props = makeProps(toon), propInst = new Map();
  function placeProps(active, d) {
    for (const [el, p] of propInst) {
      if (active.includes(el) || !p.obj.visible) continue;
      gsap.killTweensOf(p.obj.scale);
      gsap.to(p.obj.scale, { x: 0.001, y: 0.001, z: 0.001, duration: d * 0.4, ease: 'back.in(2)', onComplete: () => { p.obj.visible = false; } });
    }
    for (const el of active) {
      let p = propInst.get(el);
      if (!p) {
        const obj = props[el.dataset.prop]();
        obj.userData.size = new Box3().setFromObject(obj).getSize(new Vector3());
        obj.visible = false;
        scene.add(obj);
        p = { obj, anim: el.dataset.anim || 'float', phase: Math.random() * 6 };
        propInst.set(el, p);
      }
      // props default to a layer behind mascots so they never cut through them
      const r = rectOf(el), cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2, z = el.dataset.z != null ? +el.dataset.z : -2.5;
      p.base = px2w(cx, cy, z);
      // fit inside the anchor box on both axes
      const sz = p.obj.userData.size;
      p.s = Math.min((px2w(cx, r.t, z).y - px2w(cx, r.b, z).y) / sz.y, (px2w(r.r, cy, z).x - px2w(r.l, cy, z).x) / sz.x);
      if (p.obj.visible) continue;
      p.obj.visible = true;
      p.obj.position.copy(p.base);
      gsap.killTweensOf(p.obj.scale);
      if (d) {
        p.obj.scale.setScalar(0.001);
        gsap.to(p.obj.scale, { x: p.s, y: p.s, z: p.s, duration: 0.8, delay: 0.15, ease: 'back.out(2.2)' });
      } else p.obj.scale.setScalar(p.s);
    }
  }

  // anchors inside a not-yet-revealed build step count as absent
  const stepOf = el => { const s = el.closest('[data-step]'); return s ? +s.dataset.step : 0; };
  let lastSlide = null, lastChartEl = null, lastChart = null;
  api.show = (slide, instant = false, step = Infinity) => {
    const d = instant ? 0 : 1;
    const on = el => stepOf(el) <= step;
    if (slide !== lastSlide) { lastSlide = slide; lastChartEl = null; lastChart = null; }
    const cEl = [...slide.querySelectorAll('[data-chart]')].find(on) || null;
    if (cEl !== lastChartEl) {
      let chart = null;
      if (cEl && cEl.dataset.depth === '3d') chart = layoutChart(cEl);
      else if (cEl) {
        // 2D is the default: SVG in the slide, the 3D layer only reads bar tops for penguins
        const r = rectOf(cEl);
        const tops = show2d(cEl, d, col, points);
        chart = { type: '2d', blocks: [], labels: [], tops: tops.map(([x, y]) => px2w(r.l + x, r.t + y)) };
      }
      applyBlocks(chart?.blocks || [], d);
      setScatter(chart?.type === 'scatter' ? chart : null, d);
      setLabels(chart?.labels || [], d);
      lastChartEl = cEl;
      lastChart = chart;
    }
    for (const k of Object.keys(penguins)) {
      const a = [...slide.querySelectorAll(`[data-penguin="${k}"]`)].find(on);
      placePenguin(penguins[k], a, lastChart, d);
    }
    placeProps([...slide.querySelectorAll('[data-prop]')].filter(on), d);
  };
  // QA: screen bounds of each visible object at its highest animation pose, plus world boxes for collision checks
  const HOP = { celebrate: 0.5, jump: 0.45 };
  api.qa = () => {
    const out = [];
    const add = (name, obj, lift, foot, overlapOk = false) => {
      const box = new Box3().setFromObject(obj);
      const hi = box.clone();
      hi.max.y += lift;
      let l = 1e9, t = 1e9, rr = -1e9, b = -1e9;
      for (const x of [hi.min.x, hi.max.x]) for (const y of [hi.min.y, hi.max.y]) for (const z of [hi.min.z, hi.max.z]) {
        const [px, py] = w2px(new Vector3(x, y, z));
        l = Math.min(l, px); t = Math.min(t, py); rr = Math.max(rr, px); b = Math.max(b, py);
      }
      out.push({ name, rect: [l, t, rr - l, b - t], foot: w2px(foot), min: box.min.toArray(), max: box.max.toArray(), overlapOk });
    };
    for (const p of Object.values(penguins)) {
      if (!p.root.visible || p.root.scale.x < 0.01) continue;
      add('penguin ' + p.kind, p.root, (HOP[p.act] || 0.1) * p.root.scale.y, p.root.position);
    }
    for (const [el, p] of propInst) if (p.obj.visible && p.obj.scale.x > 0.01) add('prop ' + el.dataset.prop, p.obj, 0.05 * p.s, p.base, el.hasAttribute('data-overlap-ok'));
    return out;
  };
  api.settle = () => {
    for (let i = 0; i < 4; i++) gsap.globalTimeline.getChildren(true, true, false).forEach(t => t.progress(1));
  };
  api.setScale = k => renderer.setPixelRatio(Math.min(2, Math.max(0.5, k * (window.devicePixelRatio || 1))));

  const clock = new Clock();
  renderer.setAnimationLoop(() => {
    const t = api.freeze ? 1.3 : clock.getElapsedTime();
    charts.visible = api.layers.charts;
    layer.style.visibility = api.layers.charts ? 'visible' : 'hidden';
    for (const p of Object.values(penguins)) {
      let tilt = Math.sin(t * 2 + p.phase) * 0.05, hop = Math.abs(Math.sin(t * 4 + p.phase)) * 0.02;
      let fl = 0.15, fr = 0.15;
      if (p.moving) { tilt = Math.sin(t * 14) * 0.18; hop = Math.abs(Math.sin(t * 14)) * 0.1; }
      else if (p.act === 'wave') fl = 2.3 + Math.sin(t * 9) * 0.35;
      else if (p.act === 'jump') { hop = Math.max(0, Math.sin(t * 5 + p.phase)) * 0.45; fl = fr = 0.5; }
      else if (p.act === 'celebrate') { hop = Math.max(0, Math.sin(t * 6 + p.phase)) * 0.5; fl = fr = 1.3 + Math.sin(t * 12) * 0.4; }
      else if (p.act === 'confused') { tilt = 0.26 + Math.sin(t * 1.5) * 0.04; fr = 0.6; }
      p.body.rotation.z = tilt;
      p.body.position.y = hop;
      p.flL.rotation.z = fl;
      p.flR.rotation.z = -fr;
      p.shadow.scale.set(1.05 - hop * 0.6, 0.8 - hop * 0.45, 1);
      const blink = (t + p.phase * 3) % 3.4 < 0.12 ? 0.12 : 1;
      p.eyes.forEach(e => { e.scale.y = blink; });
      const showQ = p.root.visible && p.act === 'confused' && !p.moving && p.root.scale.x > 0.01;
      p.q.style.opacity = showQ ? 1 : 0;
      if (showQ) {
        const [x, y] = w2px(p.root.localToWorld(new Vector3(0.7, 2.6, 0)));
        p.q.style.left = x + 'px';
        p.q.style.top = y + 'px';
      }
    }
    if (pivot.visible) {
      pivot.rotation.set(0.22, -0.65 + Math.sin(t * 0.35) * 0.5, 0);
      const n = points.length;
      for (let i = 0; i < n; i++) {
        const g = Math.min(1, Math.max(0, sc.grow * 1.6 - (i / n) * 0.6));
        dummy.position.copy(dotPos[i]);
        dummy.scale.setScalar(0.017 * g + 1e-5);
        dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
      }
      dots.instanceMatrix.needsUpdate = true;
    }
    for (const p of propInst.values()) {
      if (!p.obj.visible) continue;
      const k = p.s || 1;
      p.obj.position.y = p.base.y + Math.sin(t * 1.6 + p.phase) * 0.03 * k;
      if (api.propYaw != null) p.obj.rotation.set(0.12, api.propYaw, 0);
      else if (p.anim === 'spin') p.obj.rotation.set(0.15, t * 0.6 + p.phase, 0);
      else p.obj.rotation.set(0.12, Math.sin(t * 0.6 + p.phase) * 0.15, 0);
    }
    for (const l of labels) {
      const [x, y] = w2px(l.get());
      l.el.style.left = x + 'px';
      l.el.style.top = y + 'px';
    }
    (effect || renderer).render(scene, camera);
  });
  return api;
}
