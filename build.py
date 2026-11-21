"""Build a deck (or style preview) into one self-contained HTML file.

usage: python build.py path/to/deck.html [out.html]

Markers the source page can use:
  /*@FONTS:Name,Name[400 900 italic]@*/  inline these fonts (resolved from @fontsource packages, installed on demand)
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


def font_files(spec):
    # spec is "Name" or "Name[400 900 italic]"; static fonts default to 400 and 700
    m = re.fullmatch(r"\s*([^\[]+?)\s*(?:\[([^\]]*)\])?\s*", spec)
    name, opts = m.group(1), (m.group(2) or "").split()
    italic = "italic" in opts
    weights = [w for w in opts if w.isdigit()] or ["400", "700"]
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    styles = ["normal", "italic"] if italic else ["normal"]
    # variable fonts cover every weight, so they win when fontsource has one
    var = NM / f"@fontsource-variable/{slug}" / "files"
    if not (var / f"{slug}-latin-wght-normal.woff2").exists():
        try:
            npm("install", "--no-save", f"@fontsource-variable/{slug}")
        except subprocess.CalledProcessError:
            pass
    if (var / f"{slug}-latin-wght-normal.woff2").exists():
        return name, [(var / f"{slug}-latin-wght-{st}.woff2", "100 900", st) for st in styles]
    static = NM / f"@fontsource/{slug}" / "files"
    if not static.exists():
        try:
            npm("install", "--no-save", f"@fontsource/{slug}")
        except subprocess.CalledProcessError:
            pass
    found = [(static / f"{slug}-latin-{w}-{st}.woff2", w, st) for w in weights for st in styles]
    found = [f for f in found if f[0].exists()]
    if found:
        return name, found
    sys.exit(f"font not found on fontsource: {name}")


def fonts_css(specs):
    css = ""
    for spec in specs:
        name, files = font_files(spec)
        for path, weight, style in files:
            if not path.exists():
                continue
            b64 = base64.b64encode(path.read_bytes()).decode()
            css += (f"@font-face{{font-family:'{name}';font-style:{style};font-weight:{weight};"
                    f"font-display:block;src:url(data:font/woff2;base64,{b64}) format('woff2');}}\n")
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
