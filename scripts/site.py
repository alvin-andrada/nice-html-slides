"""Rebuild the GitHub Pages demo gallery into docs/.

Each demo in DEMOS is built from examples/<src>/deck.html into docs/<slug>/index.html,
with a cover thumbnail and a content thumbnail in docs/thumbs/. site/gallery.html
becomes docs/index.html.

    python scripts/site.py
"""
import asyncio
import pathlib
import subprocess
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from qa import CHROME  # noqa: E402

# slug, example folder, slide index used for the second thumbnail
DEMOS = [
    ("penguins", "palmer-penguins", 4),
    ("web-request", "web-request", 2),
    ("supply-chain", "supply-chain-review", 2),
]
DOCS = ROOT / "docs"


# demo decks only: a link back to the gallery that shows while the mouse moves
HOME_LINK = """<a class="demo-home" href="../">&larr; All demos</a>
<style>
.demo-home { position: fixed; top: 16px; right: 16px; z-index: 9999; font: 600 14px/1 system-ui, sans-serif; letter-spacing: .02em;
  color: #fff; background: rgba(20, 20, 24, .78); padding: 10px 14px; border-radius: 999px; text-decoration: none;
  opacity: 0; transform: translateY(-6px); transition: opacity .25s, transform .25s; backdrop-filter: blur(6px); }
.demo-home.show, .demo-home:focus-visible { opacity: 1; transform: none; }
.exporting .demo-home { display: none; }
</style>
<script>
(() => {
  const a = document.querySelector('.demo-home');
  let t;
  const wake = () => { a.classList.add('show'); clearTimeout(t); t = setTimeout(() => a.matches(':hover') || a.classList.remove('show'), 2200); };
  addEventListener('mousemove', wake);
  addEventListener('touchstart', wake, { passive: true });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('#editToggle.active')) location.href = '../'; });
  wake();
})();
</script>
"""


def build(src, out, home=False):
    subprocess.run([sys.executable, str(ROOT / "build.py"), str(src), str(out)], check=True)
    if home:
        html = out.read_text(encoding="utf-8")
        i = html.rindex("</body>")
        out.write_text(html[:i] + HOME_LINK + html[i:], encoding="utf-8")


async def thumbs():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=CHROME)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        for slug, _, second in DEMOS:
            await page.goto((DOCS / slug / "index.html").as_uri())
            await page.wait_for_timeout(1500)
            await page.evaluate("document.documentElement.classList.add('exporting')")
            await page.add_style_tag(content=".edit-toggle, .edit-hotzone, .demo-home { display: none !important; }")
            for n, i in (("a", 0), ("b", second)):
                await page.evaluate(f"deck.show({i}, true, true); deck.stage3d && deck.stage3d.settle();")
                await page.wait_for_timeout(600)
                await page.screenshot(path=str(DOCS / "thumbs" / f"{slug}-{n}.jpg"), type="jpeg", quality=82)
        await browser.close()


def main():
    (DOCS / "thumbs").mkdir(parents=True, exist_ok=True)
    for slug, src, _ in DEMOS:
        (DOCS / slug).mkdir(exist_ok=True)
        build(ROOT / "examples" / src / "deck.html", DOCS / slug / "index.html", home=True)
    build(ROOT / "site" / "gallery.html", DOCS / "index.html")
    asyncio.run(thumbs())
    print("docs/ rebuilt")


if __name__ == "__main__":
    main()
