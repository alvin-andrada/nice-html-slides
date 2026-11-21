# nice-html-slides

Lively, speaker-led HTML presentations: one self-contained HTML file per deck, with smooth slide transitions, auto-playing entrances, charts that draw themselves in, and optional low-poly 3D props and mascots that react to each slide's content.

Built as an agent skill on top of [frontend-slides](https://github.com/zarazhangrui/frontend-slides), which provides the design system (presets, bold templates, the fixed 16:9 stage). This layer adds the accents, motion, checks and exports.

**Live demo:** https://alvin-andrada.github.io/nice-html-slides/ (use the arrow keys or swipe).

## Features

- **Design stays with the style.** Colours, fonts and outlines of the 3D layer and charts are read from the chosen style's CSS variables.
- **Accents that fit the content.** Props change per slide (a trophy for the best model, a magnifier on the one error). Mascots only when the topic calls for one.
- **Motion without clicking.** Each slide's parts play in automatically; slides transition with lift-away exits and split-text headings; mascots walk between slides. Click builds are available as an opt-in.
- **2D charts by default** (bars, horizontal bars, confusion matrix, scatter), styled by the deck. 3D charts on request.
- **One file.** Libraries, fonts and runtime are inlined by `build.py`; the deck works offline.
- **Automated visual checks.** Text size, contrast, spacing inside cards, overlaps, 3D objects leaving their card or intersecting each other, checked both instantly and after the real animations. Props are rendered from four angles.
- **Exports on request.** PDF, and a hybrid PPTX with editable text, native charts and tables.

## Install

1. Install the `frontend-slides` skill.
2. Clone this repo into your skills directory, for example:
   ```
   git clone https://github.com/alvin-andrada/nice-html-slides.git ~/.claude/skills/nice-html-slides
   ```
3. Have Node.js and Python 3 installed. The agent runs the one-time setup (`python scripts/setup.py`) on first use, or run it yourself.

## Usage

Ask your agent for a presentation and mention nice-html-slides, or let the skill trigger on requests for lively or animated HTML slides. It asks about content, density and accents, shows three style previews, builds the deck, runs the checks, and only exports when you say the deck is final.

Manual commands:

```
python build.py examples/palmer-penguins/deck.html
python scripts/qa.py examples/palmer-penguins/dist/deck.html
python scripts/sheet.py examples/palmer-penguins/dist/deck.html sheet.png
python scripts/export.py examples/palmer-penguins/dist/deck.html --pdf deck.pdf --pptx deck.pptx
```

## Layout

```
SKILL.md          agent instructions
RULES.md          full rule set (design, layout, motion, checks)
build.py          source deck -> single HTML
runtime/          stage3d (3D layer), charts2d, props, controller, layer CSS
scripts/          qa, turntable, sheet (contact sheets), export (PDF/PPTX)
qa/props.html     turntable page for props
examples/         Palmer Penguins example deck
docs/             built demo for GitHub Pages
```

## Credits

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
