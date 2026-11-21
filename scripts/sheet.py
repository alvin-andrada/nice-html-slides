"""Contact sheet of every slide after its real transition, or a filmstrip of one slide's entrance.

usage: python sheet.py deck.html out.png [--film SLIDE] [--chrome PATH]
"""
import argparse
import asyncio
import io
import pathlib

from PIL import Image
from playwright.async_api import async_playwright

CHROME = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


async def run(args):
    w, h = 1600, 900
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=args.chrome or None, args=CHROME)
        pg = await b.new_page(viewport={'width': w, 'height': h})
        await pg.goto(pathlib.Path(args.html).resolve().as_uri())
        await pg.wait_for_timeout(1500)
        frames = []
        if args.film is None:
            n = await pg.evaluate('deck.slides.length')
            for i in range(n):
                await pg.evaluate(f'deck.show({i})')
                await pg.wait_for_timeout(3200)
                frames.append(Image.open(io.BytesIO(await pg.screenshot())).resize((w // 2, h // 2)))
            cols = 2
        else:
            await pg.evaluate(f'deck.show({max(args.film - 2, 0)}, true, true)')
            await pg.wait_for_timeout(800)
            await pg.evaluate(f'deck.show({args.film - 1})')
            last = 0
            for t in (120, 350, 650, 1000, 1500, 2600):
                await pg.wait_for_timeout(t - last)
                last = t
                frames.append(Image.open(io.BytesIO(await pg.screenshot())).resize((w // 3, h // 3)))
            cols = 3
        fw, fh = frames[0].size
        sheet = Image.new('RGB', (fw * cols, fh * ((len(frames) + cols - 1) // cols)), 'white')
        for k, im in enumerate(frames):
            sheet.paste(im, ((k % cols) * fw, (k // cols) * fh))
        sheet.save(args.out)
        await b.close()
    print(args.out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('out')
    ap.add_argument('--film', type=int, help='1-based slide number to film from the previous slide')
    ap.add_argument('--chrome')
    asyncio.run(run(ap.parse_args()))
