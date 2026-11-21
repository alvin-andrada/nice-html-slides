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


def build(src, out):
    subprocess.run([sys.executable, str(ROOT / "build.py"), str(src), str(out)], check=True)


async def thumbs():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=CHROME)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        for slug, _, second in DEMOS:
            await page.goto((DOCS / slug / "index.html").as_uri())
            await page.wait_for_timeout(1500)
            await page.evaluate("document.documentElement.classList.add('exporting')")
            await page.add_style_tag(content=".edit-toggle, .edit-hotzone { display: none !important; }")
            for n, i in (("a", 0), ("b", second)):
                await page.evaluate(f"deck.show({i}, true, true); deck.stage3d && deck.stage3d.settle();")
                await page.wait_for_timeout(600)
                await page.screenshot(path=str(DOCS / "thumbs" / f"{slug}-{n}.jpg"), type="jpeg", quality=82)
        await browser.close()


def main():
    (DOCS / "thumbs").mkdir(parents=True, exist_ok=True)
    for slug, src, _ in DEMOS:
        (DOCS / slug).mkdir(exist_ok=True)
        build(ROOT / "examples" / src / "deck.html", DOCS / slug / "index.html")
    build(ROOT / "site" / "gallery.html", DOCS / "index.html")
    asyncio.run(thumbs())
    print("docs/ rebuilt")


if __name__ == "__main__":
    main()
