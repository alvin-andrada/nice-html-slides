"""Export a stage3d deck to PDF and/or a hybrid PPTX.

PDF: one settled screenshot per slide.
PPTX: background image (penguins, decor) + native text boxes + native charts/tables.

usage: python export.py deck.html [--pdf out.pdf] [--pptx out.pptx] [--charts native|image] [--notes]
"""
import argparse
import asyncio
import pathlib
import io
import re

from PIL import Image
from playwright.async_api import async_playwright
from pptx import Presentation
from pptx.chart.data import CategoryChartData, XyChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_MARKER_STYLE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Pt

PX = 6350  # EMU per stage pixel: 1920 px maps to a 13.333 in slide
CHROME = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
SPECIES = {'adelie': 'ff8a1f', 'chinstrap': '9b5de5', 'gentoo': '12a4a4'}
INK = RGBColor(0x1D, 0x2B, 0x4F)

COLLECT_JS = r"""(native) => {
  const slide = deck.slides[deck.current], sr = deck.stage.getBoundingClientRect(), k = sr.width / 1920;
  const box = el => { const r = el.getBoundingClientRect(); return [(r.left - sr.left) / k, (r.top - sr.top) / k, r.width / k, r.height / k]; };
  const inner = el => {
    const [x, y, w, h] = box(el), c = getComputedStyle(el), v = n => parseFloat(c[n]) || 0;
    const l = v('paddingLeft') + v('borderLeftWidth'), t = v('paddingTop') + v('borderTopWidth');
    return [x + l, y + t, w - l - v('paddingRight') - v('borderRightWidth'), h - t - v('paddingBottom') - v('borderBottomWidth')];
  };
  const direct = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const texts = [];
  for (const el of slide.querySelectorAll('*')) {
    if (!direct(el) || el.closest('.export-hide') || el.closest('[data-chart]')) continue;
    const runs = [];
    const walk = (node, st) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) {
          let t = n.textContent.replace(/\s+/g, ' ');
          if (st.textTransform === 'uppercase') t = t.toUpperCase();
          if (t) runs.push({ t, size: parseFloat(st.fontSize), bold: +st.fontWeight >= 600, color: st.color, font: st.fontFamily });
        } else if (n.nodeName === 'BR') runs.push({ br: true });
        else if (n.nodeType === 1) {
          const c = getComputedStyle(n);
          if (c.display === 'block' && runs.length) runs.push({ br: true });
          walk(n, c);
        }
      }
    };
    const cs = getComputedStyle(el);
    walk(el, cs);
    el.classList.add('export-hide');
    const flex = /flex|grid/.test(cs.display);
    const align = flex && /center/.test(cs.justifyItems + cs.justifyContent) ? 'center' : cs.textAlign;
    const middle = flex && /center/.test(cs.alignItems);
    texts.push({ box: inner(el), runs, align, middle, lh: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.2 });
  }
  const charts = [...slide.querySelectorAll('[data-chart]')].map(el => ({ box: box(el), ...el.dataset }));
  const notes = slide.innerText.replace(/\n+/g, '\n').trim();
  if (native) { deck.stage3d.layers.charts = false; document.documentElement.classList.add('export-charts-native'); }
  document.documentElement.classList.add('export-notext');
  return { texts, charts, notes, points: charts.some(c => c.chart === 'scatter') ? deck.stage3d.points : [] };
}"""

RESTORE_JS = """() => {
  document.documentElement.classList.remove('export-notext', 'export-charts-native');
  document.querySelectorAll('.export-hide').forEach(e => e.classList.remove('export-hide'));
  deck.stage3d.layers.charts = true;
}"""


def rgb(css):
    m = re.findall(r'[\d.]+', css or '')
    if len(m) < 3 or (len(m) == 4 and float(m[3]) == 0):
        return None
    return RGBColor(*[int(float(v)) for v in m[:3]])


def hexcol(c):
    c = c.strip()
    return RGBColor.from_string(SPECIES.get(c, c.lstrip('#')))


def emu(v):
    return Emu(int(v * PX))


def add_text(slide, item):
    x, y, w, h = item['box']
    runs = [r for r in item['runs']]
    if not runs:
        return
    size = max(r.get('size', 0) for r in runs if 'size' in r)
    lines = 1 + sum(1 for r in runs if r.get('br'))
    single = h < size * item['lh'] * (lines + 0.5)
    tb = slide.shapes.add_textbox(emu(x), emu(y), emu(w * (1.06 if single else 1.02)), emu(h))
    tf = tb.text_frame
    tf.word_wrap = not single
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE if item.get('middle') else MSO_ANCHOR.TOP
    para = tf.paragraphs[0]
    align = {'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT, 'end': PP_ALIGN.RIGHT}.get(item['align'], PP_ALIGN.LEFT)
    first = True
    for i, r in enumerate(runs):
        if r.get('br'):
            para = tf.add_paragraph()
            first = True
            continue
        t = r['t'].lstrip() if first else r['t']
        if i == len(runs) - 1 or runs[i + 1].get('br'):
            t = t.rstrip()
        if not t:
            continue
        first = False
        para.alignment = align
        para.line_spacing = round(item['lh'], 2)
        run = para.add_run()
        run.text = t
        f = run.font
        f.size = Pt(r['size'] * 0.5)
        f.bold = r['bold']
        f.name = r['font'].split(',')[0].strip().strip('"\'')
        col = rgb(r['color'])
        if col:
            f.color.rgb = col


def full_plot_area(chart):
    # make the plot fill the shape so native bars line up with the 3D layout
    from lxml import etree
    ns = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
    pa = chart._chartSpace.find('.//{%s}plotArea' % ns)
    old = pa.find('{%s}layout' % ns)
    if old is not None:
        pa.remove(old)
    layout = etree.SubElement(pa, '{%s}layout' % ns)
    pa.remove(layout)
    pa.insert(0, layout)
    ml = etree.SubElement(layout, '{%s}manualLayout' % ns)
    for tag, val in (('layoutTarget', 'inner'), ('xMode', 'edge'), ('yMode', 'edge'), ('x', '0'), ('y', '0'), ('w', '1'), ('h', '1')):
        etree.SubElement(ml, '{%s}%s' % (ns, tag)).set('val', val)


def style_axis_font(axis, size=12):
    axis.tick_labels.font.size = Pt(size)
    axis.tick_labels.font.color.rgb = INK


def add_chart(slide, c, points):
    x, y, w, h = c['box']
    kind = c['chart']
    names = c.get('names', '').split(',')
    raw = [v.strip() for v in c.get('values', '').split(',') if v.strip()]
    vals = [float(v) for v in raw]
    colors = [hexcol(v) for v in c.get('colors', '1d2b4f').split(',')]
    if kind in ('bars', 'hbars'):
        data = CategoryChartData()
        data.categories = names
        data.add_series('values', vals)
        ctype = XL_CHART_TYPE.COLUMN_CLUSTERED if kind == 'bars' else XL_CHART_TYPE.BAR_CLUSTERED
        chart = slide.shapes.add_chart(ctype, emu(x), emu(y), emu(w), emu(h), data).chart
        chart.has_legend = False
        chart.has_title = False
        full_plot_area(chart)
        plot = chart.plots[0]
        plot.gap_width = 100
        series = plot.series[0]
        for i in range(len(vals)):
            pt = series.points[i]
            pt.format.fill.solid()
            pt.format.fill.fore_color.rgb = colors[i % len(colors)]
        va = chart.value_axis
        va.minimum_scale = float(c.get('min', 0))
        top = float(c.get('max') or max(vals))
        va.maximum_scale = top if kind == 'bars' else va.minimum_scale + (top - va.minimum_scale) / 0.86
        va.has_major_gridlines = False
        va.visible = False
        chart.category_axis.visible = False
        if kind == 'hbars':
            chart.category_axis.reverse_order = True
        if c.get('labels') == 'values':
            plot.has_data_labels = True
            dl = plot.data_labels
            dec = max((len(v.split('.')[1]) if '.' in v else 0) for v in raw)
            fmt = '0' + ('.' + '0' * dec if dec else '')
            if '%' in c.get('format', ''):
                fmt += '"%"'
            dl.number_format = fmt
            dl.number_format_is_linked = False
            dl.font.size = Pt(17)
            dl.font.bold = True
            if kind == 'bars':
                dl.position = XL_LABEL_POSITION.INSIDE_END
                dl.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            else:
                dl.position = XL_LABEL_POSITION.OUTSIDE_END
                dl.font.color.rgb = INK
    elif kind == 'matrix':
        side = min(w, h)
        tbl = slide.shapes.add_table(3, 3, emu(x + (w - side) / 2), emu(y + (h - side) / 2), emu(side), emu(side)).table
        top = max(vals)
        for i, v in enumerate(vals):
            r, col = divmod(i, 3)
            tbl.rows[r].height = emu(side / 3)
            tbl.columns[col].width = emu(side / 3)
            cell = tbl.cell(r, col)
            cell.fill.solid()
            cell.fill.fore_color.rgb = colors[r % len(colors)] if r == col else (RGBColor(0xFF, 0x6B, 0x6B) if v else RGBColor(0xDB, 0xE6, 0xF3))
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            run = p.add_run()
            run.text = raw[i]
            run.font.size = Pt(22 if v < top else 26)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF) if v else INK
    elif kind == 'scatter':
        data = XyChartData()
        groups = {}
        for p in points:
            groups.setdefault(p['species'], []).append(p)
        for sp, pts in groups.items():
            s = data.add_series(sp.capitalize())
            for p in pts:
                s.add_data_point(p['bill'], p['flipper'])
        chart = slide.shapes.add_chart(XL_CHART_TYPE.XY_SCATTER, emu(x), emu(y), emu(w), emu(h), data).chart
        chart.has_legend = False
        chart.has_title = False
        for s, sp in zip(chart.plots[0].series, groups):
            s.marker.style = XL_MARKER_STYLE.CIRCLE
            s.marker.size = 7
            s.marker.format.fill.solid()
            s.marker.format.fill.fore_color.rgb = hexcol(sp)
            s.marker.format.line.fill.background()
            s.format.line.fill.background()
        axes = c.get('axes', 'x,y').split(',')
        for axis, title, lo, hi in ((chart.category_axis, axes[0], 30, 62), (chart.value_axis, axes[1], 168, 238)):
            axis.minimum_scale, axis.maximum_scale = lo, hi
            axis.has_major_gridlines = False
            axis.has_title = True
            axis.axis_title.text_frame.text = title.capitalize() + ' (mm)'
            axis.axis_title.text_frame.paragraphs[0].runs[0].font.size = Pt(14)
            style_axis_font(axis)


async def run(args):
    shots, slides_data = [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=args.chrome or None, args=CHROME)
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        await page.goto(pathlib.Path(args.html).resolve().as_uri())
        await page.wait_for_timeout(1500)
        await page.evaluate("document.documentElement.classList.add('exporting'); deck.stage3d.freeze = true;")
        n = await page.evaluate('deck.slides.length')
        for i in range(n):
            await page.evaluate(f'deck.show({i}, true, true); deck.stage3d.settle();')
            await page.wait_for_timeout(400)
            shots.append(Image.open(io.BytesIO(await page.screenshot())).convert('RGB'))
            if args.pptx:
                info = await page.evaluate(COLLECT_JS, args.charts == 'native')
                await page.wait_for_timeout(150)
                info['bg'] = await page.screenshot()
                await page.evaluate(RESTORE_JS)
                slides_data.append(info)
        await browser.close()

    if args.pdf:
        shots[0].save(args.pdf, save_all=True, append_images=shots[1:], resolution=144)
        print('pdf', args.pdf, len(shots), 'slides')
    if args.pptx:
        prs = Presentation()
        prs.slide_width, prs.slide_height = emu(1920), emu(1080)
        for info in slides_data:
            s = prs.slides.add_slide(prs.slide_layouts[6])
            s.shapes.add_picture(io.BytesIO(info['bg']), 0, 0, prs.slide_width, prs.slide_height)
            if args.charts == 'native':
                for c in info['charts']:
                    add_chart(s, c, info['points'])
            for t in info['texts']:
                add_text(s, t)
            if args.notes:
                s.notes_slide.notes_text_frame.text = info['notes']
        prs.save(args.pptx)
        print('pptx', args.pptx, len(slides_data), 'slides')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--pdf')
    ap.add_argument('--pptx')
    ap.add_argument('--charts', choices=['native', 'image'], default='native')
    ap.add_argument('--notes', action='store_true')
    ap.add_argument('--chrome', help='path to a Chrome/Chromium binary (default: Playwright bundled Chromium)')
    asyncio.run(run(ap.parse_args()))
