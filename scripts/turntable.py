"""Render every prop at four yaw angles into one contact sheet, to catch geometry that only breaks from behind."""
import asyncio
import pathlib
import io
import math
import sys

from PIL import Image
from playwright.async_api import async_playwright

CHROME = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


async def main(html, out, chrome=None):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=chrome, args=CHROME)
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080})
        await pg.goto(pathlib.Path(html).resolve().as_uri())
        await pg.wait_for_timeout(1500)
        shots = []
        for k in range(4):
            await pg.evaluate(f's3d.propYaw = {k * math.pi / 2}')
            await pg.wait_for_timeout(300)
            shots.append(Image.open(io.BytesIO(await pg.screenshot())).resize((960, 540)))
        sheet = Image.new('RGB', (1920, 1080))
        for k, im in enumerate(shots):
            sheet.paste(im, ((k % 2) * 960, (k // 2) * 540))
        sheet.save(out)
        await b.close()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('usage: python turntable.py qa/dist/props.html sheet.png [chrome]')
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
