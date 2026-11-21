"""Contact sheets for 3D parts that a static check cannot judge.

props:   python turntable.py qa/dist/props.html sheet.png        (every prop at four yaw angles)
mascots: python turntable.py qa/dist/mascots.html sheet.png --time   (each animation at four moments)
"""
import asyncio
import pathlib
import io
import math
import sys

from PIL import Image
from playwright.async_api import async_playwright

CHROME = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


async def main(html, out, chrome=None, timed=False):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=chrome, args=CHROME)
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080})
        await pg.goto(pathlib.Path(html).resolve().as_uri())
        await pg.wait_for_timeout(1500)
        shots = []
        poses = await pg.evaluate('document.querySelectorAll(".slide").length') if timed else 1
        for k in range(4 * poses if timed else 4):
            if timed and k % 4 == 0:
                await pg.evaluate(f'showPose({k // 4})')
            if timed:
                await pg.wait_for_timeout(230)
            else:
                await pg.evaluate(f's3d.propYaw = {k * math.pi / 2}')
                await pg.wait_for_timeout(300)
            shots.append(Image.open(io.BytesIO(await pg.screenshot())).resize((960, 540)))
        cols = 4 if timed else 2
        shots = [im.resize((480, 270)) for im in shots] if timed else shots
        fw, fh = shots[0].size
        sheet = Image.new('RGB', (fw * cols, fh * ((len(shots) + cols - 1) // cols)))
        for k, im in enumerate(shots):
            sheet.paste(im, ((k % cols) * fw, (k // cols) * fh))
        sheet.save(out)
        await b.close()

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--time']
    if len(args) < 2:
        sys.exit(__doc__)
    asyncio.run(main(args[0], args[1], args[2] if len(args) > 2 else None, '--time' in sys.argv))
