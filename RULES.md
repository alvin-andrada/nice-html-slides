# Skill rules

Working rules for the frontend-slides + 3D accent skill. They override template defaults when they conflict.

## Design authority
1. The frontend-slides style (preset or bold template) decides the look. Read its full design.md once picked and follow its palette, type roles, components and ornaments.
2. The accent layer adapts to the style, never the reverse: 3D colours, body colour and outlines come from `--s3d-*` CSS variables; 2D chart strokes, fonts and fills come from the deck CSS.
3. For formal or public talks, choose styles by the catalog's own metadata (formality, mood, tone) rather than a fixed list, and tone accents down: no mascot, at most one small prop on key slides, slower motion without bounce. If no catalog style fits, or the fitting ones have already been used, design a custom style through frontend-slides' wildcard path in the same formal register instead of reusing one.

## Density
4. Ask frontend-slides' density question every time: speaker-led (low density) or reading-first (high density). Recommend speaker-led for live talks; it is the default when the user does not answer.
5. Speaker-led: large type for projection. On the 1920x1080 stage: headings 100px+, body 42px+, labels 32px+, nothing under 28px (chart ticks included). One idea per slide, about 20 seconds each; split dense slides and shorten copy before shrinking type. No small captions, footnotes or meta lines: caveats go into body copy at full size or into speaker notes.
6. Reading-first: self-contained slides for reading alone, with structured grids, tables and annotated charts (4 to 8 bullets or 4 to 6 cards when readable). Headings 72px+, body 30px+, nothing under 22px. Short captions and source lines are allowed at 22px+. Still split a slide rather than go below the floor. Accents stay sparse (at most one prop per slide, no mascot unless it is the subject) and entrances are quick, so nothing keeps a reader waiting.
7. Both modes: no kicker or eyebrow labels above headings. Headers are noun-style titles, never questions or phrases.
8. Copy should not read as AI-generated: plain wording, few em dashes.

## Charts
9. 2D SVG charts by default, styled by the template. 3D charts only on request (`data-depth="3d"`).
10. Honest axes: zero baselines unless a truncated axis is labelled at readable size.
11. Value labels must fit inside their bars (auto-shrink), legends stay inside their card.
12. Axis ranges come from the data, rounded outward to clean ticks, never hard-coded; marks are inset from the axes by their own size. Never clip a chart to hide overflow: a clipped point is hidden data.

## Sprites, props, mascots
13. Ask whether to use sprites at all: none, content props, or props plus mascot; 2D (SVG) or 3D. Show the options inside the style previews when previews are made; otherwise describe them in text.
14. Props change per slide by relevance; not one mascot everywhere unless it is the subject (e.g. penguins for a penguin dataset).
15. Props sit in free space, at most one or two per slide. Never as list or step icons, never inside cards, never overflowing a container.
16. Idle motion stays subtle (gentle bob, small sway). Anything that rotates must look right from every angle.

## Motion
17. No click-to-reveal builds by default. Slide parts play in automatically in a staggered sequence; click builds are opt-in (`data-builds="click"`).
18. Animated transitions between slides: outgoing content lifts away, headings split in, mascots carry over between positions.
19. One motion profile per deck, matching the style. Respect reduced motion.
20. Animated backgrounds only when the style suits them: slow, low contrast, away from text, ideally content-related. Frozen during export.

## Workflow and output
21. Style discovery uses frontend-slides' three previews; each preview can carry a different accent option.
22. Edit the HTML only while iterating. Export PDF/PPTX only when the deck is final or when asked.
23. Core output is one self-contained HTML file. A build script inlines libraries, fonts and models; the agent never reads or writes bundles or base64 data.
24. PPTX export is hybrid: native text boxes, native charts/tables, sprites and decor as images. PDF shows final states.

## Layout and depth
25. Spacing comes from containers, never from matching coordinates: content that sits on a card lives inside that card, laid out with padding and grid/flex gaps. Absolute positioning is only for whole blocks on the slide (heading, card, ornaments).
26. Card padding is at least 64px on large cards and 32px on small ones; nothing on a card comes closer than 32px to its edge.
27. Leave headroom for anything that moves: if a mascot stands on a chart, the chart reserves space above its tallest bar for the mascot at its highest hop.
28. 3D objects fit their anchor box on both axes; anchors are sized for the object, not just its height.
29. 3D objects live on depth layers: props sit behind mascots by default, and mascots grouped side by side are staggered in depth so their volumes never intersect.
30. Anchors are measured from layout, not from screen position, so objects land where elements settle rather than where they are mid-animation.
31. Deliberate overlaps (a magnifier over a matrix cell) are marked `data-overlap-ok`; every other overlap is a defect.

## Checks before delivery
32. `scripts/qa.py` runs two passes, instant and animated, and checks: minimum font size (28px speaker-led, 22px reading-first); contrast against the real background (including chrome like the slide counter); text off the slide; text overlap; text or groups crossing a card edge; content closer than the minimum inset to a card edge; bar labels that do not fit; 3D objects at their highest animation pose leaving their card, overlapping a card they do not belong to, or covering text; 3D objects intersecting each other.
33. `scripts/turntable.py`: every 3D prop rendered at four angles after any prop change.
34. Contact sheet of all slides after each change, captured through the animated path; a short motion filmstrip when motion changed.
35. Loop: fix what the checks find, rerun until clean, then look at the slides. Any visible problem the checks missed becomes a new check before the fix, and the new check must flag the old build.

## Code style
36. No AI-looking comments or docstrings; short plain comments only. No space padding to align code, comments or printed output.
