/* =========================================================================
   BABUBA — vox.css companion
   1. paper-grain canvas collage in the hero (same language as the reel)
   2. department switcher
   3. mode builder
   4. scroll reveals
   ========================================================================= */
(() => {
'use strict';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ 1. HERO
   Pure-canvas paper collage: halftone disc, torn strips, four agent cards,
   a red hand-drawn arrow and a LIVE stamp. Everything flies in on load,
   then drifts. Pointer parallax per layer.
   ---------------------------------------------------------------------- */

const cv = document.getElementById('collage');
const ctx = cv.getContext('2d');

const INK = '#1A1714', PAPER = '#F3ECDE', PAPER2 = '#FAF6ED',
      RED = '#CB3428', BLUE = '#183E70', TEAL = '#0F6962', MUSTARD = '#E0A62A';

const VW = 620, VH = 570;          // virtual composition box
let scale = 1, ox = 0, oy = 0;

/* --- paper fibre pattern (built once) --- */
const pat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 220;
  const p = c.getContext('2d');
  const img = p.createImageData(220, 220);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 105;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 26 + Math.random() * 30;
  }
  p.putImageData(img, 0, 0);
  p.globalAlpha = .5;
  for (let i = 0; i < 90; i++) {           // fibres
    p.strokeStyle = Math.random() > .5 ? '#8a8172' : '#ffffff';
    p.lineWidth = Math.random() * 1.2;
    p.beginPath();
    const x = Math.random() * 220, y = Math.random() * 220;
    p.moveTo(x, y); p.lineTo(x + (Math.random() - .5) * 26, y + (Math.random() - .5) * 26);
    p.stroke();
  }
  return ctx.createPattern(c, 'repeat');
})();

/* --- helpers --- */
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* jagged (torn) bottom edge path around a rect */
function tornRect(c, x, y, w, h, seed) {
  const rnd = mulberry(seed), steps = 9, teeth = 7;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  let px = x + w, py = y + h, d = rnd() * 4;
  c.lineTo(px, py - d);
  for (let i = 1; i <= steps; i++) {
    const nx = x + w - (w * i / steps);
    const ny = y + h + (i % 2 ? -teeth * (.5 + rnd() * .7) : teeth * (.3 + rnd() * .6));
    c.lineTo(nx, ny);
  }
  c.lineTo(x, y + h - rnd()*3);
  c.closePath();
}

function shadowRect(x, y, w, h) {
  ctx.save();
  ctx.translate(7, 8);
  ctx.fillStyle = 'rgba(26,23,20,.28)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function halftone(cx, cy, r, color, dot = 7, gap = 14) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
  ctx.fillStyle = color;
  const ang = -22 * Math.PI / 180;
  ctx.translate(cx, cy); ctx.rotate(ang);
  for (let y = -r; y < r; y += gap) {
    for (let x = -r; x < r; x += gap) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      const rr = dot * (1 - d * .55) * .55;
      ctx.beginPath(); ctx.arc(x, y, Math.max(.6, rr), 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

/* --- the pieces ---------------------------------------------------------- */
/* each: draw(t, appear) where appear is 0..1 (own stagger) */
const pieces = [];

/* background halftone disc */
pieces.push({ delay: 0, draw(a) {
  ctx.save(); ctx.globalAlpha = .85 * a;
  ctx.translate(412, 250); ctx.rotate(-6 + (1-a) * 18); ctx.scale(lerp(.82,1,easeOut(a)), lerp(.82,1,easeOut(a)));
  ctx.translate(-412, -250);
  halftone(412, 250, 168, TEAL, 7.2, 14.5);
  ctx.restore();
}});

/* mustard torn strip behind the cards (diagonal) */
pieces.push({ delay: .08, draw(a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(lerp(-260, 0, easeOut(a)), 0);
  ctx.translate(150, 372); ctx.rotate(-7);
  shadowRect(0, 0, 372, 62);
  ctx.fillStyle = MUSTARD;
  tornRect(ctx, 0, 0, 372, 62, 41);
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  if (pat) { ctx.globalAlpha = a * .5; ctx.fillStyle = pat;
    tornRect(ctx, 0, 0, 372, 62, 41); ctx.fill(); ctx.globalAlpha = a; }
  ctx.fillStyle = INK;
  ctx.font = '700 27px JBM, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('ONE AGENT PER DEPARTMENT', 20, 30);
  ctx.restore();
}});

/* four agent cards */
const CARD_W = 176, CARD_H = 118;
const cards = [
  { x: 52,  y: 92,  rot: -6,  fill: '#DFE7F0', tag: 'HR',       sub: 'shortlists three',  delay: .18, seed: 3 },
  { x: 300, y: 66,  rot: 5,   fill: '#F6DFD7', tag: 'SALES',    sub: 'sends the quote',   delay: .3,  seed: 9 },
  { x: 96,  y: 236, rot: 3,   fill: '#DCEBE2', tag: 'ACCOUNTS', sub: 'chases the payment',delay: .42, seed: 17 },
  { x: 330, y: 214, rot: -4,  fill: '#F4E7C4', tag: 'OPS',      sub: 'books the courier',  delay: .54, seed: 27 }
];
cards.forEach((c, i) => {
  pieces.push({ delay: c.delay, draw(a) {
    const e = easeOut(a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(c.x + CARD_W/2 + (1-e) * (i % 2 ? 130 : -130), c.y + CARD_H/2 + (1-e) * 90);
    ctx.rotate((c.rot * Math.PI / 180) + (1-e) * (i % 2 ? .5 : -.5));
    ctx.translate(-CARD_W/2, -CARD_H/2);
    shadowRect(0, 0, CARD_W, CARD_H);
    ctx.fillStyle = c.fill;
    tornRect(ctx, 0, 0, CARD_W, CARD_H, c.seed);
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    if (pat) { ctx.save(); ctx.globalAlpha = a * .45; ctx.fillStyle = pat;
      tornRect(ctx, 0, 0, CARD_W, CARD_H, c.seed); ctx.fill(); ctx.restore(); }
    /* glyph plate */
    ctx.fillStyle = INK;
    ctx.fillRect(14, 16, 34, 34);
    ctx.fillStyle = c.fill;
    ctx.font = '700 19px BS, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.tag.slice(0, 2), 31, 34);
    /* labels */
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = '700 13px JBM, monospace';
    ctx.fillText(c.tag, 14, 72);
    ctx.font = '400 12px WS, sans-serif';
    ctx.fillStyle = 'rgba(26,23,20,.72)';
    ctx.fillText(c.sub, 14, 92);
    ctx.restore();
  }});
});

/* red arrow from ACCOUNTS to OPS */
pieces.push({ delay: .68, draw(a) {
  const e = easeOut(a);
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  const p0 = [272, 292], p1 = [312, 330], p2 = [352, 300];
  // partial draw
  const steps = 40, n = Math.max(2, Math.round(steps * e));
  ctx.moveTo(p0[0], p0[1]);
  for (let i = 1; i <= n; i++) {
    const t = i / steps, mt = 1 - t;
    ctx.lineTo(mt*mt*p0[0] + 2*mt*t*p1[0] + t*t*p2[0],
               mt*mt*p0[1] + 2*mt*t*p1[1] + t*t*p2[1]);
  }
  ctx.stroke();
  if (e > .8) {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(p2[0] + 10, p2[1] - 4);
    ctx.lineTo(p2[0] - 8, p2[1] - 9);
    ctx.lineTo(p2[0] + 2, p2[1] + 10);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}});

/* LIVE stamp */
pieces.push({ delay: .88, draw(a) {
  const e = easeOut(a);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(512, 116);
  ctx.rotate(-14 * Math.PI/180 + (1-e) * .6);
  ctx.scale(lerp(1.5, 1, e), lerp(1.5, 1, e));
  ctx.strokeStyle = RED; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.stroke();
  ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 17px JBM, monospace';
  ctx.fillText('LIVE', 0, -5);
  ctx.font = '700 10px JBM, monospace';
  ctx.fillText('TODAY', 0, 12);
  ctx.restore();
}});

/* handwritten note */
pieces.push({ delay: 1.0, draw(a) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.translate(30, 480);
  ctx.rotate(-4 * Math.PI/180);
  ctx.fillStyle = BLUE;
  ctx.font = '400 27px HAND, cursive';
  ctx.fillText('one chat. four jobs. done.', 0, 0);
  ctx.strokeStyle = BLUE; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, 12);
  ctx.quadraticCurveTo(120, 20, 300, 8);
  ctx.stroke();
  ctx.restore();
}});

/* loose scraps that drift */
const scraps = Array.from({ length: 9 }, (_, i) => {
  const rnd = mulberry(100 + i * 7);
  return {
    x: rnd() * VW, y: rnd() * VH, w: 26 + rnd() * 46, h: 12 + rnd() * 18,
    rot: rnd() * 6.28, sp: .18 + rnd() * .3, ph: rnd() * 6.28,
    col: ['#DFE7F0', '#F6DFD7', '#DCEBE2', '#F4E7C4'][i % 4]
  };
});

/* --- render loop --------------------------------------------------------- */
let start = performance.now(), t0 = 0;
let mx = 0, my = 0, tmx = 0, tmy = 0;

function resize() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  scale = Math.min(r.width / VW, r.height / VH);
  ox = (r.width - VW * scale) / 2;
  oy = (r.height - VH * scale) / 2;
}

function frame(now) {
  const t = (now - start) / 1000;
  const dpr = cv.width / cv.getBoundingClientRect().width || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* parallax smoothing */
  mx = lerp(mx, tmx, .07); my = lerp(my, tmy, .07);

  /* drifting scraps (behind) */
  scraps.forEach((s, i) => {
    const yy = s.y + Math.sin(t * s.sp + s.ph) * 9;
    ctx.save();
    ctx.globalAlpha = .8;
    ctx.translate(s.x + mx * (6 + i), yy + my * (6 + i));
    ctx.rotate(s.rot + Math.sin(t * s.sp * .6 + s.ph) * .05);
    ctx.fillStyle = s.col;
    ctx.fillRect(-s.w/2, -s.h/2, s.w, s.h);
    ctx.strokeStyle = 'rgba(26,23,20,.5)'; ctx.lineWidth = 1.6;
    ctx.strokeRect(-s.w/2, -s.h/2, s.w, s.h);
    ctx.restore();
  });

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.translate(VW/2, VH/2);
  ctx.translate(mx * 10, my * 8);
  ctx.translate(-VW/2, -VH/2);

  pieces.forEach(p => {
    const a = reduce ? 1 : Math.max(0, Math.min(1, (t - p.delay) / .85));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = 1;
    /* gentle float once settled */
    const fl = a >= 1 ? Math.sin(t * .8 + (p.delay * 6)) * 2.2 : 0;
    ctx.translate(fl * .6, fl);
    p.draw(a);
    ctx.restore();
  });

  ctx.restore();
  requestAnimationFrame(frame);
}

/* fonts must exist before canvas text is drawn */
const fams = ['700 20px BS', '700 14px JBM', '400 14px WS', '400 27px HAND'];
function boot() {
  resize();
  start = performance.now();
  requestAnimationFrame(frame);
}
Promise.all([
  document.fonts.load('700 40px BS'),
  document.fonts.load('700 20px JBM'),
  document.fonts.load('400 20px WS'),
  document.fonts.load('400 27px HAND')
]).then(() => {
  /* canvas needs concrete aliases */
  boot();
}).catch(boot);
/* also start immediately so nothing is blank; fonts usually land first frame */
boot();

addEventListener('resize', () => { resize(); });
addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect();
  tmx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width/2)) / (r.width/2)));
  tmy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height/2)) / (r.height/2)));
});

/* ------------------------------------------------------- 2. DEPARTMENTS */
const DATA = [
  {
    kicker: 'agent 01 — human resources',
    title: 'Reads the resumes. Shortlists three. Books the interviews.',
    steps: [
      'Screens every application against your JD — not a keyword list.',
      'Shortlists three, with one line on why each one passed.',
      'Books the interview slots and sends the confirmations.'
    ],
    thread:
`hr · 38 applications, ops role

against your JD — 11 pass.
top 3:
 1. nithin r — 4 yrs, 200+ hires
 2. anjali s — pharma ops, exact fit
 3. faisal m — strong, asks +20%

slots sent:
 fri 11:00 · fri 15:30 · mon 10:00`,
    chip: '3 booked · 2 slots open'
  },
  {
    kicker: 'agent 02 — sales',
    title: 'Chases the lead. Sends the quote. Logs the call.',
    steps: [
      'Answers the enquiry in the channel it arrived on — usually WhatsApp.',
      'Sends the quote as a PDF and the payment link in the same thread.',
      'Logs every touch to the sheet and sets its own follow-up date.'
    ],
    thread:
`sales · new enquiry — whatsapp

meridian traders:
 12 units, wants delivery by fri

quote #Q-114 sent 14:22
payment link sent, pdf attached
follow-up set: thu, 11:00

logged to sheet · row 214`,
    chip: 'awaiting their reply'
  },
  {
    kicker: 'agent 03 — accounts',
    title: 'Raises the invoice. Matches the payment. Chases what\'s overdue.',
    steps: [
      'Raises the invoice from the order and emails it with the terms.',
      'Matches the bank line to the invoice and marks it reconciled.',
      'Chases only what is genuinely overdue — in the tone you set.'
    ],
    thread:
`accounts · month to date

raised  #2041  ₹1,84,500
matched #2038  ₹56,000  ✓
matched #2039  ₹2,10,000 ✓

overdue:
 #1987  15 days  — follow-up drafted
 #1992  4 days

awaiting your go on #1987`,
    chip: '1 approval waiting'
  },
  {
    kicker: 'agent 04 — operations',
    title: 'Order in. Courier booked. Sheet updated. Customer told.',
    steps: [
      'Takes the order as it lands and checks stock before promising a date.',
      'Books the courier, captures the AWB, writes the row into your sheet.',
      'Messages the customer the tracking link — no one has to ask.'
    ],
    thread:
`ops · order #8821

stock ok — 12 units
courier booked · dtdc
awb 4471 9920 3318

sheet updated  → ops!row 88
customer told   → whatsapp
delivery        → fri, before 6 pm`,
    chip: 'closed · nothing pending'
  }
];

const cardsEl = [...document.querySelectorAll('.dept')];
const sc = {
  kicker: document.getElementById('sc-kicker'),
  title: document.getElementById('sc-title'),
  steps: document.getElementById('sc-steps'),
  thread: document.getElementById('sc-thread'),
  chip: document.getElementById('sc-chip')
};

function selectDept(i, animate = true) {
  const d = DATA[i];
  cardsEl.forEach((c, j) => c.setAttribute('aria-selected', String(i === j)));
  sc.kicker.textContent = d.kicker;
  sc.title.textContent = d.title;
  sc.steps.innerHTML = d.steps.map(s => `<li>${s}</li>`).join('');
  sc.thread.textContent = d.thread;
  sc.chip.textContent = d.chip;
  if (animate && !reduce) {
    sc.thread.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' }
    );
  }
}
cardsEl.forEach(c => {
  c.addEventListener('click', () => selectDept(+c.dataset.i));
  c.addEventListener('mouseenter', () => selectDept(+c.dataset.i, false));
});
selectDept(0, false);

/* ------------------------------------------------------------ 3. MODES */
const skillEls = [...document.querySelectorAll('.skill')];
const modeName = document.getElementById('mode-name');
const modeTone = document.getElementById('mode-tone');
const modeList = document.getElementById('mode-list');
const modeCount = document.getElementById('mode-count');

const NAMES = {
  ledger:  ['The Ledger',  '"precise, brief, never chases twice in a week"'],
  desk:    ['The Front Desk', '"warm, short sentences, always ends with a next step"'],
  closer:  ['The Closer',  '"quick, specific, quotes a number in every reply"'],
  maker:   ['The Maker',   '"writes it, publishes it, checks it live"'],
  custom:  ['Your Mode',   '"your tone, your line in the sand"']
};

function refreshMode() {
  const on = skillEls.filter(s => s.getAttribute('aria-pressed') === 'true').map(s => s.textContent.trim());
  modeCount.textContent = on.length;
  const has = n => on.includes(n);
  let key = 'custom';
  if (has('raise invoice') || has('chase payment')) key = 'ledger';
  else if (has('read inbox') && has('draft mail')) key = 'desk';
  else if (has('browse & fill forms') || has('post to website')) key = 'maker';
  else if (has('whatsapp reply')) key = 'closer';
  modeName.textContent = NAMES[key][0];
  modeTone.textContent = NAMES[key][1];
  modeList.innerHTML = on.length
    ? on.slice(0, 9).map(s => `<li>${s}</li>`).join('')
    : '<li>nothing yet — tap a skill</li>';
}
skillEls.forEach(s => {
  s.addEventListener('click', () => {
    s.setAttribute('aria-pressed', s.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    refreshMode();
  });
});
refreshMode();

/* ---------------------------------------------------------- 4. REVEALS */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: .16, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* header shadow on scroll */
const head = document.querySelector('header');
addEventListener('scroll', () => {
  head.style.boxShadow = scrollY > 12 ? '0 6px 0 rgba(26,23,20,.12)' : 'none';
}, { passive: true });

})();
