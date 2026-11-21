"""Automated checks for a built deck: text size, contrast, spacing inside cards, overlap, and 3D objects (bounds at peak pose, collisions).

usage: python qa.py deck.html [--min 28] [--inset 32]
Exit code 1 when any issue is found.
"""
import argparse
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

CHROME = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

CHECK_JS = r"""([minSize, minInset]) => {
  const slide = deck.slides[deck.current], sr = deck.stage.getBoundingClientRect(), k = sr.width / 1920;
  const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = c => {
    const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const bgOf = el => {
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c;
    }
    return [255, 255, 255];
  };
  const direct = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const els = [...slide.querySelectorAll('*'), ...deck.stage.querySelectorAll(':scope > .counter')].filter(direct);
  const issues = [], boxes = [];
  for (const el of els) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || el.closest('[style*="opacity: 0"]')) continue;
    const r = el.getBoundingClientRect();
    const box = [(r.left - sr.left) / k, (r.top - sr.top) / k, r.width / k, r.height / k];
    const name = el.textContent.trim().slice(0, 40);
    const size = parseFloat(cs.fontSize);
    if (size < minSize) issues.push(`small text ${size}px: "${name}"`);
    if (box[0] < -2 || box[1] < -2 || box[0] + box[2] > 1922 || box[1] + box[3] > 1082) issues.push(`off slide: "${name}"`);
    if (!el.closest('svg')) {
      const fg = parse(cs.color), bg = bgOf(el);
      const sh = cs.textShadow, shc = parse(sh);
      const outlined = sh !== 'none' && shc.length >= 3 && (shc.length < 4 || shc[3] >= 0.8) && lum(shc) < 0.1;
      const need = size >= 36 ? 3 : 4.5;
      const cr = ratio(fg, bg);
      if (cr < need && !outlined) issues.push(`low contrast ${cr.toFixed(2)}: "${name}"`);
    }
    boxes.push({ box, name, el });
  }
  // text that starts on a card must end on it
  const cards = [...slide.querySelectorAll('.card, .surface-card')].map(c => { const r = c.getBoundingClientRect(); return [(r.left - sr.left) / k, (r.top - sr.top) / k, r.width / k, r.height / k]; });
  const groups = [...slide.querySelectorAll('.abs:not(.card):not(.surface-card), .chart')].filter(el => !el.querySelector('.card, .surface-card')).map(el => {
    const r = el.getBoundingClientRect();
    return { box: [(r.left - sr.left) / k, (r.top - sr.top) / k, r.width / k, r.height / k], name: el.textContent.trim().slice(0, 40) || el.className };
  }).filter(g => g.box[2] > 0 && g.box[3] > 0);
  for (const { box, name } of [...boxes, ...groups]) for (const c of cards) {
    const inside = box[0] >= c[0] - 1 && box[1] >= c[1] - 1 && box[0] + box[2] <= c[0] + c[2] + 1 && box[1] + box[3] <= c[1] + c[3] + 1;
    const apart = box[0] >= c[0] + c[2] || box[0] + box[2] <= c[0] || box[1] >= c[1] + c[3] || box[1] + box[3] <= c[1];
    if (!inside && !apart) issues.push(`crosses card edge: "${name}"`);
  }
  // value labels must fit inside their bars
  slide.querySelectorAll('.chart2d').forEach(svg => {
    const rects = [...svg.querySelectorAll('rect')].map(r => r.getBBox());
    svg.querySelectorAll('text.in').forEach(t => {
      const b = t.getBBox(), host = rects.find(r => b.x + b.width / 2 >= r.x && b.x + b.width / 2 <= r.x + r.width && b.y >= r.y - 2);
      if (host && (b.x < host.x + 6 || b.x + b.width > host.x + host.width - 6)) issues.push(`label wider than bar: "${t.textContent}"`);
    });
  });
  // breathing room: anything on a card keeps a minimum inset from its edges
  const inset = (b, c) => Math.min(b[0] - c[0], b[1] - c[1], c[0] + c[2] - b[0] - b[2], c[1] + c[3] - b[1] - b[3]);
  const within = (b, c) => b[0] >= c[0] - 1 && b[1] >= c[1] - 1 && b[0] + b[2] <= c[0] + c[2] + 1 && b[1] + b[3] <= c[1] + c[3] + 1;
  for (const { box, name } of [...boxes, ...groups]) for (const c of cards) {
    if (within(box, c) && inset(box, c) < minInset) issues.push(`tight to card edge (${Math.round(inset(box, c))}px): "${name}"`);
  }
  // 3D objects at their highest animation pose
  const over = (a, b, m = 4) => Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > m && Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > m;
  const objs = deck.stage3d ? deck.stage3d.qa() : [];
  for (const o of objs) {
    const [fx, fy] = o.foot;
    const home = cards.find(c => fx >= c[0] && fx <= c[0] + c[2] && fy >= c[1] && fy <= c[1] + c[3]);
    if (home) { if (!within(o.rect, home) || inset(o.rect, home) < 12) issues.push(`${o.name} leaves its card`); }
    else if (cards.some(c => over(o.rect, c))) issues.push(`${o.name} overlaps a card`);
    // slide chrome (counter, nav dots) must stay clear of 3D objects
    for (const ch of deck.stage.querySelectorAll(':scope > .counter, :scope > .navdots')) {
      const r = ch.getBoundingClientRect();
      if (r.width && over(o.rect, [(r.left - sr.left) / k, (r.top - sr.top) / k, r.width / k, r.height / k], 2)) issues.push(`${o.name} touches slide chrome`);
    }
    if (!o.overlapOk) for (const t of boxes) if (over(o.rect, t.box, 6)) issues.push(`${o.name} covers text "${t.name}"`);
  }
  for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
    const a = objs[i], b = objs[j];
    const hit = [0, 1, 2].every(d => Math.min(a.max[d], b.max[d]) - Math.max(a.min[d], b.min[d]) > 0.02);
    if (hit) issues.push(`${a.name} and ${b.name} intersect in 3D`);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.box[0] + a.box[2], b.box[0] + b.box[2]) - Math.max(a.box[0], b.box[0]);
    const h = Math.min(a.box[1] + a.box[3], b.box[1] + b.box[3]) - Math.max(a.box[1], b.box[1]);
    if (w > 4 && h > 4) issues.push(`text overlap: "${a.name}" / "${b.name}"`);
  }
  return issues;
}"""


async def run(args):
    found = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=args.chrome or None, args=CHROME)
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        await page.goto(pathlib.Path(args.html).resolve().as_uri())
        await page.wait_for_timeout(1500)
        await page.evaluate("document.documentElement.classList.add('exporting')")
        n = await page.evaluate('deck.slides.length')
        seen = set()
        # instant pass checks the final layout; animated pass checks where objects land after the real transitions
        for mode in ('instant', 'animated'):
            if mode == 'animated':
                await page.evaluate("document.documentElement.classList.remove('exporting'); deck.show(0, true, true)")
            for i in range(n):
                if mode == 'instant':
                    await page.evaluate(f'deck.show({i}, true, true); deck.stage3d && deck.stage3d.settle();')
                    await page.wait_for_timeout(300)
                else:
                    await page.evaluate(f'deck.show({i})')
                    await page.wait_for_timeout(3200)
                # idle animations keep moving, so sample several moments and keep every issue seen
                found_now = []
                for _ in range(4):
                    found_now += await page.evaluate(CHECK_JS, [args.min, args.inset])
                    await page.wait_for_timeout(170)
                for issue in dict.fromkeys(found_now):
                    if (i, issue) in seen:
                        continue
                    seen.add((i, issue))
                    print(f'slide {i + 1} ({mode}): {issue}')
                    found += 1
        await browser.close()
    print('ok' if not found else f'{found} issue(s)')
    return found


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--min', type=float, default=28)
    ap.add_argument('--inset', type=float, default=32)
    ap.add_argument('--chrome', help='path to a Chrome/Chromium binary (default: Playwright bundled Chromium)')
    sys.exit(1 if asyncio.run(run(ap.parse_args())) else 0)
