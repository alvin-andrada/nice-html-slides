/* === MOTION PROFILE === */
const { gsap, SplitText } = window.Stage3D;
const MOTION = Object.assign({ ease: 'power3.out', dur: 0.6, stagger: 0.08, entry: 0.3, group: 0.45 }, window.NICE_MOTION || {});
const exporting = () => document.documentElement.classList.contains('exporting');

/* === EDIT CHROME === */
document.body.insertAdjacentHTML('beforeend', '<div class="edit-hotzone"></div><button class="edit-toggle" id="editToggle" title="Edit mode (E)">✏️</button>');
const EDIT_KEY = 'nice-html-slides:' + document.title;

/* === INLINE EDITING === */
const editor = {
  isActive: false,
  targets: () => document.getElementById('deckStage').querySelectorAll(window.NICE_EDITABLE || 'h1, h2, h3, h4, p, li, blockquote, .stat, .row > div, .pill, .badge, .editable'),
  toggleEditMode() {
    this.isActive = !this.isActive;
    if (this.isActive) deck.revertSplits();
    this.targets().forEach(el => el.contentEditable = this.isActive);
    document.getElementById('editToggle').classList.toggle('active', this.isActive);
    if (!this.isActive) this.save();
  },
  save() {
    try { localStorage.setItem(EDIT_KEY, JSON.stringify([...this.targets()].map(el => el.innerHTML))); } catch (e) {}
  },
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(EDIT_KEY) || 'null');
      if (saved) this.targets().forEach((el, i) => { if (saved[i] != null) el.innerHTML = saved[i]; });
    } catch (e) {}
  },
};
editor.load();

/* === SLIDE CONTROLLER WITH BUILD STEPS === */
class SlidePresentation {
  constructor() {
    this.stage = document.getElementById('deckStage');
    this.slides = [...this.stage.querySelectorAll('.slide')];
    this.current = -1;
    this.step = 0;
    this.clickBuilds = document.getElementById('deckStage').dataset.builds === 'click';
    this.stage3d = window.Stage3D ? Stage3D.init(this.stage) : null;
    this.scale();
    addEventListener('resize', () => this.scale());
    this.nav();
    this.show(0);
  }
  scale() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    this.stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
    if (this.stage3d) this.stage3d.setScale(k);
  }
  nav() {
    addEventListener('keydown', e => {
      if (e.target.isContentEditable) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); this.next(); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); this.prev(); }
    });
    let lock = 0;
    addEventListener('wheel', e => {
      if (Date.now() < lock || Math.abs(e.deltaY) < 20) return;
      lock = Date.now() + 700;
      e.deltaY > 0 ? this.next() : this.prev();
    }, { passive: true });
    let x0 = null;
    addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) dx < 0 ? this.next() : this.prev();
      x0 = null;
    });
  }
  maxStep(s) {
    return Math.max(0, ...[...s.querySelectorAll('[data-step]')].map(e => +e.dataset.step));
  }
  next() {
    if (this.clickBuilds && this.step < this.maxStep(this.slides[this.current])) { this.step++; this.applyStep(true); }
    else this.show(this.current + 1);
  }
  prev() {
    if (this.clickBuilds && this.step > 0) { this.step--; this.applyStep(true); }
    else this.show(this.current - 1, false, true);
  }
  show(i, instant = false, allSteps = false) {
    i = Math.max(0, Math.min(i, this.slides.length - 1));
    if (i === this.current && !instant) return;
    const old = this.slides[this.current];
    this.current = i;
    const s = this.slides[i];
    (this.timers || []).forEach(t => t.kill());
    this.timers = [];
    if (old && old !== s && !instant) this.exit(old);
    this.slides.forEach((el, n) => { el.classList.toggle('active', n === i); el.classList.toggle('visible', n === i); });
    const max = this.maxStep(s);
    if (instant || allSteps) { this.step = max; this.applyStep(!instant, true); }
    else if (this.clickBuilds) { this.step = 0; this.applyStep(true, true); }
    else {
      // auto builds: each step group plays in on its own after the slide enters
      this.step = 0;
      this.applyStep(true, true);
      for (let n = 1; n <= max; n++) {
        this.timers.push(gsap.delayedCall(MOTION.entry + n * MOTION.group, () => { this.step = n; this.applyStep(true); }));
      }
    }
    if (!instant && !exporting()) this.splitIn(s);
    document.querySelectorAll('#navdots i').forEach((d, n) => d.classList.toggle('on', n === i));
    const count = document.getElementById('count');
    if (count) count.textContent = `${i + 1} / ${this.slides.length}`;
  }
  exit(old) {
    const kids = [...old.children].filter(el => !el.matches('.p3d, .prop'));
    gsap.fromTo(kids, { opacity: 1, y: 0 }, { opacity: 0, y: -28, duration: 0.35, ease: 'power2.in', stagger: 0.015,
      onComplete: () => gsap.set(kids, { clearProps: 'opacity,transform' }) });
  }
  applyStep(animate, entering = false) {
    const s = this.slides[this.current], fresh = [];
    s.querySelectorAll('[data-step]').forEach(el => {
      const on = +el.dataset.step <= this.step;
      if (on && !el.classList.contains('built')) { el.classList.add('built'); fresh.push(el); }
      else if (!on && el.classList.contains('built')) { el.classList.remove('built'); gsap.set(el, { clearProps: 'opacity,transform' }); }
    });
    const visual = fresh.filter(el => !el.matches('.p3d, .prop, [data-chart]'));
    if (animate && visual.length) {
      gsap.fromTo(visual, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: MOTION.dur, ease: MOTION.ease, stagger: MOTION.stagger, delay: entering ? MOTION.entry : 0 });
    }
    if (this.stage3d) this.stage3d.show(s, !animate, this.step);
  }
  splitIn(s) {
    if (document.fonts && document.fonts.status !== 'loaded') { document.fonts.ready.then(() => this.splitIn(s)); return; }
    s.querySelectorAll('h1, h2').forEach(h => {
      if (!h._split) h._split = SplitText.create(h, { type: 'words,chars' });
      gsap.fromTo(h._split.chars, { yPercent: 70, opacity: 0, rotate: 8 },
        { yPercent: 0, opacity: 1, rotate: 0, duration: 0.55, ease: MOTION.ease, stagger: 0.022, delay: 0.1 });
    });
  }
  revertSplits() {
    this.stage.querySelectorAll('h1, h2').forEach(h => { if (h._split) { h._split.revert(); h._split = null; } });
  }
}
const deck = new SlidePresentation();
window.deck = deck;

const toggle = document.getElementById('editToggle'), hotzone = document.querySelector('.edit-hotzone');
let hideTimeout = null;
const hideSoon = () => { hideTimeout = setTimeout(() => { if (!editor.isActive) toggle.classList.remove('show'); }, 400); };
hotzone.addEventListener('mouseenter', () => { clearTimeout(hideTimeout); toggle.classList.add('show'); });
hotzone.addEventListener('mouseleave', hideSoon);
toggle.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
toggle.addEventListener('mouseleave', hideSoon);
toggle.addEventListener('click', () => editor.toggleEditMode());
hotzone.addEventListener('click', () => editor.toggleEditMode());
document.addEventListener('keydown', e => {
  if ((e.key === 'e' || e.key === 'E') && !e.target.isContentEditable) editor.toggleEditMode();
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (editor.isActive) editor.save(); }
});
document.addEventListener('input', () => { if (editor.isActive) editor.save(); });
