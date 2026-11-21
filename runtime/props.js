// Low-poly props built from primitives. Each returns a Group centred on the origin with userData.h (height).
import {
  Group, Mesh, BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, LatheGeometry,
  IcosahedronGeometry, SphereGeometry, MeshBasicMaterial, Vector2, DoubleSide,
} from 'three';

function add(g, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  g.add(m);
  return m;
}

// pal comes from the deck's --s3d-prop-* variables so props take the style's colours
export function makeProps(toon, pal = {}) {
  const ink = toon('#1d2b4f');
  const base = Object.assign({ main: '#ffc53d', dark: '#2b3550', light: '#eef3f8', accent: '#12a4a4' }, pal);
  // a slide can override the palette, so each prop gets its own materials
  const mats = (p = {}) => Object.fromEntries(Object.entries({ ...base, ...p }).map(([k, c]) => [k, toon(c)]));
  return {
    laptop(p) {
      const { dark, light, main } = mats(p), g = new Group();
      add(g, new BoxGeometry(2.2, 0.12, 1.4), dark, [0, -0.6, 0.25]);
      add(g, new BoxGeometry(1.8, 0.02, 0.6), light, [0, -0.53, 0.05]);
      const lid = new Group();
      add(lid, new BoxGeometry(2.2, 1.45, 0.1), dark, [0, 0.72, 0]);
      add(lid, new BoxGeometry(1.95, 1.2, 0.02), main, [0, 0.74, 0.06]);
      lid.position.set(0, -0.6, -0.42);
      lid.rotation.x = -0.18;
      g.add(lid);
      g.userData.h = 1.6;
      return g;
    },
    router(p) {
      const { dark, main } = mats(p), g = new Group();
      add(g, new BoxGeometry(2.0, 0.5, 1.2), dark, [0, -0.45, 0]);
      for (const x of [-0.7, 0, 0.7]) add(g, new CylinderGeometry(0.06, 0.07, 1.1, 8), dark, [x, 0.3, -0.4], [0, 0, x * -0.25]);
      for (const x of [-0.6, -0.3, 0, 0.3]) add(g, new SphereGeometry(0.07, 10, 8), main, [x, -0.45, 0.61]);
      g.userData.h = 1.8;
      return g;
    },
    server(p) {
      const { dark, light, main } = mats(p), g = new Group();
      add(g, new BoxGeometry(1.3, 2.2, 1.1), dark);
      for (let i = 0; i < 4; i++) {
        const y = 0.75 - i * 0.5;
        add(g, new BoxGeometry(1.0, 0.3, 0.04), light, [-0.05, y, 0.56]);
        add(g, new SphereGeometry(0.06, 10, 8), main, [0.38, y, 0.6]);
      }
      g.userData.h = 2.2;
      return g;
    },
    globe(p) {
      const { main, light, accent } = mats(p), g = new Group();
      add(g, new IcosahedronGeometry(1, 1), main);
      add(g, new TorusGeometry(1.35, 0.05, 8, 48), light, [0, 0, 0], [1.25, 0.3, 0]);
      add(g, new SphereGeometry(0.12, 10, 8), accent, [1.12, 0.62, 0.5]);
      g.userData.h = 2.3;
      return g;
    },
    packet(p) {
      const { dark, light, accent } = mats(p), g = new Group();
      add(g, new BoxGeometry(1.8, 1.15, 0.12), dark);
      for (const sx of [-1, 1]) add(g, new BoxGeometry(1.06, 0.07, 0.04), light, [sx * 0.43, 0.27, 0.08], [0, 0, sx * 0.6]);
      add(g, new BoxGeometry(0.34, 0.34, 0.04), accent, [0.55, -0.3, 0.08]);
      g.userData.h = 1.2;
      return g;
    },
    ruler() {
      const g = new Group(), body = new Group();
      add(body, new BoxGeometry(2.8, 0.55, 0.1), toon('#ffd166'));
      for (let i = 0; i <= 10; i++) add(body, new BoxGeometry(0.035, i % 5 ? 0.16 : 0.28, 0.12), ink, [-1.3 + i * 0.26, 0.275 - (i % 5 ? 0.08 : 0.14), 0.02]);
      body.rotation.z = 0.3;
      g.add(body);
      g.userData.h = 1.3;
      return g;
    },
    broom() {
      const g = new Group(), b = new Group();
      add(b, new CylinderGeometry(0.06, 0.06, 2.0, 10), toon('#b07a4f'), [0, 0.45, 0]);
      add(b, new CylinderGeometry(0.16, 0.5, 0.7, 12), toon('#ffcf5c'), [0, -0.85, 0]);
      add(b, new TorusGeometry(0.17, 0.05, 8, 16), toon('#e76f51'), [0, -0.52, 0], [Math.PI / 2, 0, 0]);
      b.rotation.z = -0.45;
      g.add(b);
      g.userData.h = 2.3;
      return g;
    },
    pie() {
      const g = new Group(), p = new Group();
      const big = 0.8 * Math.PI * 2, two = c => { const m = toon(c); m.side = DoubleSide; return m; };
      add(p, new CylinderGeometry(1, 1, 0.4, 40, 1, false, 0, big), two('#12a4a4'));
      const mid = big + (Math.PI * 2 - big) / 2;
      add(p, new CylinderGeometry(1, 1, 0.4, 16, 1, false, big, Math.PI * 2 - big), two('#ff8a1f'), [Math.sin(mid) * 0.28, 0.12, Math.cos(mid) * 0.28]);
      p.rotation.x = 0.55;
      g.add(p);
      g.userData.h = 1.6;
      return g;
    },
    forest() {
      const g = new Group();
      const leaf = [toon('#3bb273'), toon('#2a9d61')];
      [[-0.95, 0.8], [0, 1.1], [0.95, 0.85]].forEach(([x, s], i) => {
        const t = new Group();
        add(t, new CylinderGeometry(0.1, 0.13, 0.5, 8), toon('#9c6b45'), [0, -0.75, 0]);
        add(t, new ConeGeometry(0.62, 0.95, 8), leaf[i % 2], [0, -0.15, 0]);
        add(t, new ConeGeometry(0.45, 0.8, 8), leaf[(i + 1) % 2], [0, 0.4, 0]);
        t.position.x = x;
        t.scale.setScalar(s);
        t.position.y = (s - 1) * 1;
        g.add(t);
      });
      g.userData.h = 2.3;
      return g;
    },
    trophy() {
      const g = new Group(), gold = toon('#ffc53d');
      const pts = [[0.13, 0], [0.13, 0.25], [0.42, 0.32], [0.68, 0.6], [0.8, 1.1], [0.74, 1.15]].map(([x, y]) => new Vector2(x, y));
      const cup = gold.clone();
      cup.side = DoubleSide;
      add(g, new LatheGeometry(pts, 32), cup, [0, -0.25, 0]);
      for (const sx of [-1, 1]) add(g, new TorusGeometry(0.24, 0.07, 8, 20, Math.PI), gold, [sx * 0.72, 0.5, 0], [0, 0, -sx * Math.PI / 2]);
      add(g, new BoxGeometry(0.8, 0.2, 0.55), ink, [0, -0.38, 0]);
      add(g, new BoxGeometry(1.1, 0.2, 0.75), ink, [0, -0.56, 0]);
      g.userData.h = 1.7;
      return g;
    },
    magnifier() {
      const g = new Group(), m = new Group();
      add(m, new TorusGeometry(0.7, 0.12, 12, 40), ink);
      add(m, new CylinderGeometry(0.7, 0.7, 0.03, 40), Object.assign(new MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.28, depthWrite: false }), { userData: { outlineParameters: { visible: false } } }), [0, 0, 0], [Math.PI / 2, 0, 0]);
      add(m, new CylinderGeometry(0.11, 0.13, 1.1, 12), toon('#9b5de5'), [0.78, -0.78, 0], [0, 0, Math.PI / 4]);
      g.add(m);
      g.userData.h = 2.2;
      return g;
    },
    flag() {
      const g = new Group();
      add(g, new CylinderGeometry(0.05, 0.05, 2.6, 8), toon('#c9d6e3'));
      add(g, new BoxGeometry(1.2, 0.75, 0.04), toon('#12a4a4'), [0.62, 0.85, 0]);
      add(g, new IcosahedronGeometry(0.1, 0), toon('#ffc53d'), [0, 1.35, 0]);
      g.userData.h = 2.8;
      return g;
    },
    iceberg() {
      const g = new Group();
      add(g, new IcosahedronGeometry(1, 0), toon('#e9f6ff'), [0, 0, 0], [0.3, 0.4, 0], [1.4, 0.8, 1]);
      add(g, new IcosahedronGeometry(0.6, 0), toon('#cfe8fb'), [0.5, 0.45, 0.2], [0.2, 0.9, 0], [1, 1.3, 1]);
      g.userData.h = 1.8;
      return g;
    },
  };
}
