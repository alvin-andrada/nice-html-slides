"""Build a deck (or style preview) into one self-contained HTML file.

usage: python build.py path/to/deck.html [out.html]

Markers the source page can use:
  /*@FONTS:Name,Name@*/  inline these fonts (resolved from @fontsource packages, installed on demand)
  /*@NICE_CSS@*/          the shared layer CSS (3D canvas, anchors, builds, export modes)
  <!--@STAGE3D@-->        three.js + GSAP + stage3d runtime (only when the deck uses 3D, charts or motion)
  <!--@NICE_JS@-->        slide controller (navigation, auto builds, transitions, inline editing)
  <!--@BASE@-->, <!--@FIT@-->  minimal stage + scaler for single-slide previews
"""
import base64
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
NM = ROOT / "node_modules"


def npm(*args):
    cmd = shutil.which("npm") or "npm"
    subprocess.run([cmd, *args], cwd=ROOT, check=True)


def font_file(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    candidates = [
        (f"@fontsource-variable/{slug}", f"{slug}-latin-wght-normal.woff2", "100 900"),
        (f"@fontsource/{slug}", f"{slug}-latin-400-normal.woff2", "400"),
    ]
    for pkg, file, weight in candidates:
        path = NM / pkg / "files" / file
        if path.exists():
            return path, weight
    for pkg, file, weight in candidates:
        try:
            npm("install", "--no-save", pkg)
        except subprocess.CalledProcessError:
            continue
        path = NM / pkg / "files" / file
        if path.exists():
            return path, weight
    sys.exit(f"font not found on fontsource: {name}")


def fonts_css(names):
    css = ""
    for name in names:
        path, weight = font_file(name)
        b64 = base64.b64encode(path.read_bytes()).decode()
        css += (f"@font-face{{font-family:'{name}';font-style:normal;font-weight:{weight};"
                f"font-display:block;src:url(data:font/woff2;base64,{b64}) format('woff2');}}\n")
        if not path.parent.parent.name.startswith("@fontsource-variable") and (path.parent / path.name.replace("-400-", "-700-")).exists():
            bold = base64.b64encode((path.parent / path.name.replace("-400-", "-700-")).read_bytes()).decode()
            css += (f"@font-face{{font-family:'{name}';font-style:normal;font-weight:700;"
                    f"font-display:block;src:url(data:font/woff2;base64,{bold}) format('woff2');}}\n")
    return css


def runtime_bundle():
    if not (NM / "three").exists() or not (NM / "gsap").exists():
        npm("install")
    out = ROOT / ".build" / "stage3d.bundle.js"
    npx = shutil.which("npx") or "npx"
    subprocess.run([npx, "esbuild", str(RUNTIME / "stage3d.js"), "--bundle", "--minify", "--format=iife",
                    "--global-name=Stage3D", "--target=es2020", f"--outfile={out}", "--log-level=warning"],
                   cwd=ROOT, check=True)
    return out.read_text(encoding="utf-8").replace("</script", "<\\/script")


def build(src, out):
    html = src.read_text(encoding="utf-8")
    for marker, file in (("<!--@BASE@-->", "preview-base.html"), ("<!--@FIT@-->", "preview-fit.html")):
        if marker in html:
            html = html.replace(marker, (RUNTIME / file).read_text(encoding="utf-8"))
    m = re.search(r"/\*@FONTS(?::([^@]*))?@\*/", html)
    if m:
        names = [n.strip() for n in (m.group(1) or "").split(",") if n.strip()]
        html = html.replace(m.group(0), fonts_css(names))
    if "/*@NICE_CSS@*/" in html:
        html = html.replace("/*@NICE_CSS@*/", (RUNTIME / "layer.css").read_text(encoding="utf-8"))
    if "<!--@STAGE3D@-->" in html:
        html = html.replace("<!--@STAGE3D@-->", f"<script>{runtime_bundle()}</script>")
    if "<!--@NICE_JS@-->" in html:
        js = (RUNTIME / "controller.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
        html = html.replace("<!--@NICE_JS@-->", f"<script>\n{js}</script>")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out} {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1]).resolve()
    out = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else src.parent / "dist" / src.name
    build(src, out)
