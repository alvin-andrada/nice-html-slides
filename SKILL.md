---
name: nice-html-slides
description: Lively, speaker-led HTML slide decks built on frontend-slides, with optional 3D props and mascots, auto-playing entrances, slide transitions, styled 2D charts, automated visual checks, and PDF/hybrid PPTX export on request. Use when the user wants an HTML presentation that feels animated and polished, wants 3D accents or props in slides, or asks for nice-html-slides by name.
---

# nice-html-slides

An extension layer for the `frontend-slides` skill. frontend-slides owns content discovery, style discovery and the visual system. This skill adds props and mascots, motion, chart rendering, a build step that produces one self-contained HTML file, automated checks, and exports.

Read `RULES.md` before generating. It is the full rule set; the summary below is the order of work.

## Requirements and first use

- The `frontend-slides` skill. If it is not installed, install it next to this skill from https://github.com/zarazhangrui/frontend-slides (or ask the user to), then continue.
- Node.js and Python 3 on the machine.
- Before the first build, if `node_modules/` is missing in this folder, run `python scripts/setup.py` yourself. It installs the build packages, the Python packages and a headless browser. Do not ask the user to run setup commands.

## Workflow

### 1. Content (frontend-slides Phase 1, with two changes)
- Default density is low density / speaker-led. Only switch when the user asks for a reading deck.
- Add one question about accents, with these options described in plain words:
  - **None**: typography and charts carry the deck. Lightest file, most formal.
  - **Content props**: small objects tied to each slide's point (a trophy for the best model, a magnifier on an error). Adds about 550 KB when 3D.
  - **Mascot**: one recurring character that reacts to content, only when the topic suggests one.
  - **2D or 3D**: flat SVG sprites are lighter; 3D gives depth and characters that move between slides.

### 2. Style (frontend-slides Phase 2)
- Generate the three previews exactly as frontend-slides prescribes. The style decides the look.
- Where accents are wanted, give each preview a different accent option, so style and accent are chosen together.
- Formal or public talks: pick styles by catalog metadata (formality, mood, tone). If none fit or the fitting ones were used, use the custom wildcard path in the same register.
- Previews are single files with `<!--@BASE@-->` and `<!--@FIT@-->` markers; build them with `python build.py preview.html`.

### 3. Generate the deck
Start from frontend-slides' HTML architecture, then apply this skill's conventions:

- In `<style>`: `/*@FONTS:Display Font,Body Font@*/` (fonts are inlined from fontsource, installed on demand) and `/*@NICE_CSS@*/`.
- Before `</body>`: `<!--@STAGE3D@-->` when the deck uses props, mascots, charts or motion; then optionally `<script>window.NICE_MOTION = {...}</script>`; then `<!--@NICE_JS@-->` (navigation, auto builds, transitions, inline editing). Do not write a slide controller by hand.
- Slide container: `<main class="deck-stage" id="deckStage">` with `<section class="slide">` children, as in frontend-slides.
- Theme the accent layer from the style's tokens with CSS variables on `:root`: `--s3d-adelie`-style species/series colours are optional; the general ones are `--s3d-body`, `--s3d-outline`, `--s3d-outline-width`. Style 2D charts in the deck CSS (`.chart2d rect`, `.chart2d .v`, `.chart2d .tick`, ...).
- Layout: content on a card lives inside that card, laid out with padding and grid/flex. Absolute positioning only for whole blocks.

Data attributes:

| Attribute | On | Meaning |
|---|---|---|
| `data-step="n"` | any element | plays in n groups after the slide enters (auto); click-driven only with `data-builds="click"` on the stage |
| `data-chart="bars\|hbars\|matrix\|scatter"` | `.chart` | 2D SVG chart; also `data-values`, `data-colors`, `data-min`, `data-max`, `data-labels="values"`, `data-format="{v}%"`, `data-names`, `data-off`, `data-empty`, `data-axes` |
| `data-depth="3d"` | `.chart` | 3D chart instead of 2D; only when the user asks |
| `data-penguin="kind"` | `.p3d` anchor | mascot placed in the anchor box; `data-act` (idle, wave, jump, celebrate, confused), `data-face` (degrees), `data-on="i"` (stand on bar i), `data-z` (depth layer) |
| `data-prop="name"` | `.prop` anchor | low-poly prop fitted to the anchor box; `data-anim="spin"` only for props that read well from every angle; `data-z` |
| `data-overlap-ok` | `.prop` | a deliberate overlap the checks should allow |
| class `inl` | `.p3d`/`.prop` | anchor that sits in the layout flow (inside flex rows) |

The built-in mascot is a penguin (`adelie`, `chinstrap`, `gentoo`) and the props are `ruler`, `broom`, `pie`, `forest`, `trophy`, `magnifier`, `flag`, `iceberg` (`runtime/props.js`). For other topics, add a builder to `runtime/props.js` from primitives in the same style: centred on the origin, toon materials, `userData.h` set. Every new prop goes through the turntable check.

### 4. Build and check (every change)
```
python build.py path/to/deck.html                      # -> path/to/dist/deck.html
python scripts/qa.py path/to/dist/deck.html            # must print "ok"
python build.py qa/props.html && python scripts/turntable.py qa/dist/props.html turntable.png   # after any prop change
python build.py qa/mascots.html && python scripts/turntable.py qa/dist/mascots.html poses.png --time   # after any mascot change
python scripts/sheet.py path/to/dist/deck.html sheet.png                                     # look at it
python scripts/sheet.py path/to/dist/deck.html film.png --film 8                             # when motion changed
```
Fix what the checks report, rerun until clean, then look at the sheet. A visible problem the checks missed becomes a new check in `scripts/qa.py` that flags the old build, before fixing the deck.

Token discipline: never open `node_modules/`, `.build/`, `dist/` HTML, or inlined base64. Edit the source deck and runtime files only.

### 5. Iterate
Edit the HTML source only. Do not export while iterating.

### 6. Export (only when the deck is final or the user asks)
```
python scripts/export.py path/to/dist/deck.html --pdf deck.pdf --pptx deck.pptx --notes
```
PDF: one image per slide at final state. PPTX (hybrid): native text boxes, native charts and tables, decor and 3D as an image layer. Use `--charts image` to keep charts as pictures. After exporting, render the PPTX once and check it.

## Example
`examples/palmer-penguins/deck.html` is a reference for syntax only: how markers, anchors and data attributes are written. Open it only when unsure how an attribute is used. Never copy its style, palette, layout, copy, ornaments, mascot or props into a new deck; the style comes from the user's frontend-slides choice and the accents from the user's answer and the deck's own content. A deck that is not about penguins never gets penguins.
