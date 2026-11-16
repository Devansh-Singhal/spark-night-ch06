// Nabz replay UI. Every view is a pure function of (scenario, operator decision, playhead t)
// plus the deterministic run from engine.js. Nothing here invents results.
import {
  JOB, DETECTOR, SCENARIOS, BAND_LABELS, BASELINE, COST_DEFAULTS,
  runScenario, outcomes, currentTrace, segmentArcs, clockAt, pid,
} from './engine.js';

const N = JOB.lastPart - JOB.firstPart + 1;           // parts in the interval
const CYC = JOB.cycleSec;
const $ = (id) => document.getElementById(id);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const C = {
  ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), grid: css('--grid'), axis: css('--axis'),
  ok: css('--ok'), warn: css('--warn'), crit: css('--crit'), arc: css('--arc'), surface: css('--surface'),
  surface2: css('--surface-2'), surface3: css('--surface-3'), mono: css('--mono'), sans: css('--sans'),
};
const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const fmtMin = (m) => (Math.round(m * 10) / 10).toFixed(1) + ' min';

// ------------------------------------------------------------------ state
const SPEEDS = [
  { id: 'slow', label: '×24', pps: 0.5, title: '1 part every 2 s' },
  { id: 'norm', label: '×96', pps: 2, title: '2 parts per second' },
  { id: 'fast', label: '×240', pps: 5, title: '5 parts per second' },
];
const S = {
  scn: 'fault',
  t: 0.2,                    // playhead in parts (0..N); starts mid-W1 of part 0101
  playing: false,
  speed: SPEEDS[1],
  decision: {},              // per scenario: 'act' | 'ignore'
  revealed: {},              // per scenario: reached the teardown once
  holdPaused: {},            // per scenario+decision: already paused at the first hold
  cost: { ...COST_DEFAULTS },
  hover: null,
  started: false,
};
let RUNS = {}, OUT = null;
function compute() {
  RUNS = { act: runScenario(S.scn, 'act'), ignore: runScenario(S.scn, 'ignore') };
  OUT = outcomes(S.scn, S.decision[S.scn] || 'act', S.cost);
  traceCache.clear();
  yMax = Math.max(4, ...RUNS.ignore.parts.map((p) => p.score || 0), ...RUNS.act.parts.map((p) => p.score || 0)) * 1.08;
  buildBracket();
  lastKeys = {};
}
const dec = () => S.decision[S.scn] || null;
const run = () => RUNS[dec() || 'act'];
const advIdx = () => (RUNS.act.advisory ? RUNS.act.advisory.part - JOB.firstPart : null);
const revealed = () => !!S.revealed[S.scn];
const branchClock = (r, p) => clockAt(p, r.intervention && p > r.intervention.part ? r.intervention.minutes : 0);
// wall clock when part p comes off the fixture (a stop after p is not counted)
const endClock = (r, p) => clockAt(p + 1, r.intervention && p > r.intervention.part ? r.intervention.minutes : 0);

// ------------------------------------------------------------------ playback
let lastTs = null;
function tick(ts) {
  if (lastTs == null) lastTs = ts;
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  if (S.playing) advance(dt * S.speed.pps);
  draw(ts);
  requestAnimationFrame(tick);
}
function advance(dp) {
  let t = S.t + dp;
  const a = advIdx();
  // the run cannot continue past the advisory until the operator decides
  if (a != null && !dec() && t >= a + 1) { t = a + 1; pause(); }
  const r = run();
  const holdKey = S.scn + (dec() || 'act');
  const firstHold = r.parts.find((p) => p.rule === 'hold');
  if (firstHold && !S.holdPaused[holdKey]) {
    const hi = firstHold.part - JOB.firstPart + 1;
    if (S.t < hi && t >= hi) { t = hi; S.holdPaused[holdKey] = true; pause(); }
  }
  if (t >= N) { t = N; S.revealed[S.scn] = true; pause(); }
  S.t = t;
}
function play() {
  const a = advIdx();
  if (a != null && !dec() && S.t >= a + 1) { pulseDecision(); return; }
  if (S.t >= N) S.t = 0;
  S.playing = true;
}
function pause() { S.playing = false; }
function setT(t) {
  const a = advIdx();
  if (a != null && !dec() && t > a + 1) { t = a + 1; pulseDecision(); }
  S.t = Math.max(0, Math.min(N, t));
  if (S.t >= N) S.revealed[S.scn] = true;
}
function pulseDecision() {
  const el = $('decision');
  el.classList.remove('pending'); void el.offsetWidth; el.classList.add('pending');
}

// ------------------------------------------------------------------ derived view state
function view() {
  const r = run();
  const t = S.t;
  const done = Math.min(N, Math.floor(t + 1e-9));          // completed parts
  const idx = Math.min(N - 1, done);                        // part on the fixture
  const phase = t >= N ? 1 : t - idx;
  const sec = phase * CYC;
  const last = done > 0 ? r.parts[done - 1] : null;
  // at an exact part boundary (e.g. paused at the alert) keep the finished part on the stage
  const atBoundary = done > 0 && (t >= N || phase < 1e-6);
  const sIdx = atBoundary ? done - 1 : idx;
  const sSec = atBoundary ? CYC : sec;
  return { r, t, done, idx: sIdx, phase, sec: sSec, part: r.parts[sIdx], last };
}

// ------------------------------------------------------------------ canvas helpers
function fit(cv) {
  const dpr = window.devicePixelRatio || 1;
  const h = +cv.getAttribute('height');
  const w = cv.clientWidth;
  if (cv._w !== w || cv._dpr !== dpr) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    cv._w = w; cv._dpr = dpr;
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
let GUT = 132, NARROW = false;
const RPAD = 18;
const xOf = (w, i) => GUT + ((i + 0.5) / N) * (w - GUT - RPAD);
const xT = (w, t) => GUT + (t / N) * (w - GUT - RPAD);
const iOfX = (w, x) => Math.max(0, Math.min(N - 1, Math.floor(((x - GUT) / (w - GUT - RPAD)) * N)));
function hatch(g, x, y, w, h, color, gap = 4) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = color; g.lineWidth = 1.2;
  for (let k = -h; k < w + h; k += gap) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.stroke(); }
  g.restore();
}

// ------------------------------------------------------------------ weld stage (SVG)
const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const SEAMS = [
  { d: 'M 204 104 L 204 158', lx: 178, ly: 98 },
  { d: 'M 346 104 L 346 158', lx: 356, ly: 98 },
  { d: 'M 433.5 193.5 A 52 52 0 1 1 506.5 193.5', lx: 470, ly: 94 },
  { d: 'M 250 184 L 310 184', lx: 280, ly: 262 },
];
let STAGE = null;
function buildBracket() {
  const svg = $('bracket');
  svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  const rg = el('radialGradient', { id: 'glow' }, defs);
  el('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '1' }, rg);
  el('stop', { offset: '.25', 'stop-color': C.arc, 'stop-opacity': '.85' }, rg);
  el('stop', { offset: '1', 'stop-color': C.arc, 'stop-opacity': '0' }, rg);
  const plateG = el('linearGradient', { id: 'plate', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#3a3936' }, plateG);
  el('stop', { offset: 1, 'stop-color': '#2b2a28' }, plateG);
  const part = el('g', { id: 'partG' }, svg);
  el('rect', { x: 60, y: 56, width: 520, height: 228, rx: 14, fill: 'url(#plate)', stroke: '#55534e', 'stroke-width': 1.5 }, part);
  for (const [cx, cy] of [[100, 96], [100, 244], [540, 96], [540, 244]]) el('circle', { cx, cy, r: 11, fill: '#141413', stroke: '#55534e' }, part);
  // upright plate + gussets + tab + tube
  el('rect', { x: 150, y: 160, width: 250, height: 20, fill: '#4a4844', stroke: '#6a6862' }, part);
  el('rect', { x: 208, y: 100, width: 12, height: 60, fill: '#45433f', stroke: '#6a6862' }, part);
  el('rect', { x: 330, y: 100, width: 12, height: 60, fill: '#45433f', stroke: '#6a6862' }, part);
  el('rect', { x: 250, y: 188, width: 60, height: 44, rx: 3, fill: '#403f3b', stroke: '#6a6862' }, part);
  el('circle', { cx: 252 + 28, cy: 214, r: 7, fill: '#141413' }, part);
  el('circle', { cx: 470, cy: 158, r: 46, fill: '#4a4844', stroke: '#6a6862' }, part);
  el('circle', { cx: 470, cy: 158, r: 33, fill: '#151514', stroke: '#2e2d2b' }, part);
  const seams = SEAMS.map((s, w) => {
    const g = el('g', {}, part);
    const guide = el('path', { d: s.d, fill: 'none', stroke: '#6f6c66', 'stroke-width': 1.4, 'stroke-dasharray': '3 4' }, g);
    const bead = el('path', { d: s.d, fill: 'none', stroke: '#8d877b', 'stroke-width': 8, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': '0 100' }, g);
    const ripple = el('path', { d: s.d, fill: 'none', stroke: '#5d5850', 'stroke-width': 6, pathLength: 100, 'stroke-dasharray': '0 100' }, g);
    const lab = el('text', { x: s.lx, y: s.ly, fill: C.ink2, 'font-family': C.mono, 'font-size': 12, 'text-anchor': 'middle' }, g);
    lab.textContent = JOB.welds[w].id;
    const len = bead.getTotalLength();
    return { guide, bead, ripple, lab, len, path: bead };
  });
  const torch = el('g', { opacity: 0 }, svg);
  const halo = el('circle', { r: 46, fill: 'url(#glow)' }, torch);
  const core = el('circle', { r: 5, fill: '#fff' }, torch);
  const note = el('text', { x: 320, y: 318, fill: C.ink3, 'font-family': C.sans, 'font-size': 12, 'text-anchor': 'middle' }, svg);
  STAGE = { svg, part, seams, torch, halo, core, note };
}
// ripple dash pattern scaled to the visible bead length
function setBead(seam, frac) {
  const f = Math.max(0, Math.min(1, frac)) * 100;
  seam.bead.setAttribute('stroke-dasharray', `${f} ${100 - f + 1}`);
  // ripple: short dark ticks inside the bead, only over the welded portion
  const n = Math.max(1, Math.floor(f / 2.2));
  let arr = [];
  for (let i = 0; i < n; i++) arr.push(0.6, 1.6);
  arr.push(0, 100);
  seam.ripple.setAttribute('stroke-dasharray', arr.join(' '));
}
function mixHex(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

const traceCache = new Map();
function traceFor(r, i) {
  const key = (r.decision) + ':' + i;
  if (!traceCache.has(key)) {
    const p = r.parts[i];
    const scn = SCENARIOS[S.scn];
    const fixed = r.intervention && p.part > r.intervention.part && !scn.benign;
    const tr = currentTrace(scn, p.part, p.severity, scn.dropouts.includes(p.part), !fixed);
    traceCache.set(key, tr);
  }
  return traceCache.get(key);
}

function drawStage(v, ts) {
  const { r, idx, sec, part } = v;
  const tr = traceFor(r, idx);
  const hz = DETECTOR.sampleHz;
  const k = Math.min(tr ? tr.length - 1 : 0, Math.floor(sec * hz));
  // part cadence: fade the part out at unload and in at load
  const fade = sec > 46 && sec < CYC ? 1 - ((sec - 46) / 2) * 0.5 : sec < 1.5 ? 0.5 + 0.5 * (sec / 1.5) : 1;
  STAGE.part.setAttribute('opacity', fade.toFixed(3));
  let live = null;
  const slots = [];
  JOB.welds.forEach((wd, w) => {
    const seam = STAGE.seams[w];
    const slot = part.arcs ? part.arcs[w] : null;
    let frac = 0, status = 'pending';
    if (tr && slot) {
      if (sec >= slot.end) { frac = 1; status = 'done'; }
      else if (sec >= slot.start) { frac = (sec - slot.start) / slot.dur; status = 'live'; live = { w, frac, slot }; }
    } else if (tr && !slot) {
      if (sec > wd.start + wd.dur) status = 'miss';
    } else if (!tr) {
      // clamp signal lost: the weld still happens, Nabz just can't see it
      if (sec >= wd.start + wd.dur) { frac = 1; status = 'blind'; }
      else if (sec >= wd.start) { frac = (sec - wd.start) / wd.dur; status = 'blind'; live = { w, frac, slot: { start: wd.start, dur: wd.dur } }; }
    }
    setBead(seam, frac);
    // heat tint fades over ~10 s of process time after the arc stops
    const end = slot ? slot.end : wd.start + wd.dur;
    const since = sec - end;
    const heat = status === 'live' ? 1 : frac > 0 && since > 0 ? Math.exp(-since / 6) : 0;
    seam.bead.setAttribute('stroke', mixHex('#8d877b', '#ff9a4a', heat * 0.9));
    seam.guide.setAttribute('stroke', status === 'miss' ? C.crit : '#6f6c66');
    seam.guide.setAttribute('stroke-width', status === 'miss' ? 2 : 1.4);
    seam.lab.setAttribute('fill', status === 'miss' ? C.crit : status === 'live' ? C.arc : C.ink2);
    seam.lab.textContent = JOB.welds[w].id + (status === 'miss' ? ' · no arc' : '');
    slots.push(status);
  });
  if (live && v.t < N) {
    const seam = STAGE.seams[live.w];
    const pt = seam.path.getPointAtLength(Math.min(1, live.frac) * seam.len);
    const flick = 0.75 + 0.25 * Math.sin(ts / 23) * Math.sin(ts / 7.3);
    STAGE.torch.setAttribute('opacity', flick.toFixed(2));
    STAGE.torch.setAttribute('transform', `translate(${pt.x},${pt.y})`);
    STAGE.halo.setAttribute('r', (38 + 10 * flick).toFixed(1));
  } else STAGE.torch.setAttribute('opacity', 0);
  STAGE.note.textContent = v.t >= N ? '' : 'Bead surface looks the same on every part. The inside is checked only at the teardown.';

  // readouts
  $('roPart').textContent = pid(part.part);
  $('roClock').textContent = clockAt(part.part, (r.intervention && part.part > r.intervention.part ? r.intervention.minutes : 0) + sec / 60);
  $('roArc').textContent = live ? `${JOB.welds[live.w].id} ${JOB.welds[live.w].name}` : sec < 6 || sec > 40 ? 'load / unload' : '—';
  $('roAmps').textContent = tr ? `${Math.round(tr[k])} A` : 'no signal';
  const key = slots.join(',');
  if (lastKeys.slots !== key) {
    lastKeys.slots = key;
    $('arcCount').innerHTML = slots.map((s, w) => `<span class="slot ${s === 'blind' ? '' : s}" title="${JOB.welds[w].name}">${JOB.welds[w].id}</span>`).join('');
  }
}

// ------------------------------------------------------------------ current trace
function drawTrace(v) {
  const cv = $('trace');
  const { g, w, h } = fit(cv);
  const L = 44, R = 10, T = 22, B = 20;
  const pw = w - L - R, ph = h - T - B;
  const X = (s) => L + (s / CYC) * pw;
  const yM = 240;
  const Y = (a) => T + ph - (a / yM) * ph;
  g.font = `11px ${C.mono}`;
  // grid
  g.strokeStyle = C.grid; g.lineWidth = 1; g.fillStyle = C.ink3; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const a of [0, 100, 200]) { g.beginPath(); g.moveTo(L, Y(a)); g.lineTo(w - R, Y(a)); g.stroke(); g.fillText(a, L - 6, Y(a)); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let s = 0; s <= CYC; s += pw < 500 ? 12 : 6) g.fillText(s + ' s', X(s), h - B + 5);
  // recipe windows
  const r = v.r, part = v.part;
  JOB.welds.forEach((wd, wi) => {
    const slot = part.arcs ? part.arcs[wi] : null;
    const missed = part.arcs && !slot && v.sec > wd.start + wd.dur;
    g.fillStyle = missed ? 'rgba(208,59,59,.12)' : 'rgba(255,255,255,.035)';
    g.fillRect(X(wd.start), T, X(wd.start + wd.dur) - X(wd.start), ph);
    if (missed) { g.setLineDash([4, 3]); g.strokeStyle = C.crit; g.strokeRect(X(wd.start) + .5, T + .5, X(wd.start + wd.dur) - X(wd.start), ph); g.setLineDash([]); }
    const seen = slot && v.sec >= slot.end;
    g.fillStyle = missed ? C.crit : seen ? C.ink : C.ink3; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(missed ? (pw < 500 ? '✕' : `${wd.id} no arc`) : seen && pw >= 500 ? `${wd.id} ${slot.dur.toFixed(2)} s` : wd.id, X(wd.start), 4);
  });
  // thresholds
  g.setLineDash([2, 3]); g.strokeStyle = C.ink3;
  for (const [a, lab] of [[DETECTOR.ampsOn, 'on 40 A'], [DETECTOR.ampsOff, 'off 20 A']]) {
    g.beginPath(); g.moveTo(L, Y(a)); g.lineTo(w - R, Y(a)); g.stroke();
  }
  g.setLineDash([]);
  const tr = traceFor(r, v.idx);
  if (!tr) {
    g.fillStyle = C.ink2; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `13px ${C.sans}`;
    g.fillText('Clamp signal lost for this part — arcs cannot be counted', L + pw / 2, T + ph / 2);
    return;
  }
  const hz = DETECTOR.sampleHz;
  const k = Math.min(tr.length, Math.floor(v.sec * hz) + 1);
  g.strokeStyle = C.ink; g.lineWidth = 1.2; g.beginPath();
  for (let i = 0; i < k; i++) { const x = X(i / hz), y = Y(tr[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  // cursor
  g.strokeStyle = C.arc; g.globalAlpha = .6; g.beginPath(); g.moveTo(X(v.sec), T); g.lineTo(X(v.sec), T + ph); g.stroke(); g.globalAlpha = 1;
}

// ------------------------------------------------------------------ score chart
let yMax = 4;
function drawScore(v) {
  const cv = $('scoreCv');
  const { g, w, h } = fit(cv);
  const T = 14, B = 22, ph = h - T - B;
  const Y = (s) => T + ph - (Math.min(s, yMax) / yMax) * ph;
  const r = v.r, thr = BASELINE.threshold;
  g.font = `11px ${C.mono}`;
  // grid + axis
  g.strokeStyle = C.grid; g.fillStyle = C.ink3; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineWidth = 1;
  for (let s = 0; s <= yMax; s += 1) { g.beginPath(); g.moveTo(GUT, Y(s)); g.lineTo(w - RPAD, Y(s)); g.stroke(); g.fillText(s.toFixed(0), GUT - 8, Y(s)); }
  // known-good band
  g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(GUT, Y(thr), w - GUT - RPAD, Y(0) - Y(thr));
  g.setLineDash([5, 4]); g.strokeStyle = C.ink2; g.beginPath(); g.moveTo(GUT, Y(thr)); g.lineTo(w - RPAD, Y(thr)); g.stroke(); g.setLineDash([]);
  g.textAlign = 'left'; g.fillStyle = C.ink2; g.font = `11px ${C.sans}`;
  g.fillText(NARROW ? 'thr ' + thr.toFixed(2) : 'threshold ' + thr.toFixed(2), 8, Y(thr));
  g.fillStyle = C.ink3;
  if (!NARROW) g.fillText('known-good', 8, Y(thr * 0.45));
  g.fillText('score (σ)', 8, T + 4);
  // part ticks
  g.font = `11px ${C.mono}`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = C.ink3;
  for (let i = 9; i < N; i += NARROW ? 30 : 10) g.fillText(pid(JOB.firstPart + i), xOf(w, i), h - B + 6);

  // ghost: same run without the operator's check (revealed after the teardown)
  const ghost = RUNS.ignore;
  if (revealed() && r.intervention && r !== ghost) {
    const from = r.intervention.part - JOB.firstPart + 1;
    g.strokeStyle = C.ink3; g.lineWidth = 1;
    for (let i = from; i < Math.min(v.done, N); i++) {
      const s = ghost.parts[i].score; if (s == null) continue;
      g.beginPath(); g.arc(xOf(w, i), Y(s), 3, 0, 7); g.stroke();
    }
    g.fillStyle = C.ink2; g.font = `11px ${C.sans}`; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('●  after the check      ○  same run if the operator had kept running', w - RPAD, 0);
  }
  // per-arc scores (small) and part scores (median) — only what has happened
  for (let i = 0; i <= Math.min(v.idx, N - 1); i++) {
    const p = r.parts[i];
    if (!p.arcScores) continue;
    const complete = i < v.done;
    p.arcScores.forEach((a, wi) => {
      if (!a) return;
      if (!complete && p.arcs[wi] && v.sec < p.arcs[wi].end) return;
      g.fillStyle = 'rgba(195,194,183,.35)';
      const y = Y(a.score);
      g.beginPath(); g.arc(xOf(w, i), y, 1.6, 0, 7); g.fill();
      if (a.score > yMax) { g.fillStyle = C.ink3; g.fillText('▲', xOf(w, i), T - 12); }
    });
  }
  for (let i = 0; i < v.done; i++) {
    const p = r.parts[i];
    if (p.score == null) {
      g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('×', xOf(w, i), Y(0) - 2);
      continue;
    }
    g.fillStyle = p.elevated ? C.ink : C.ink2;
    g.strokeStyle = C.surface; g.lineWidth = 1.5;
    g.beginPath(); g.arc(xOf(w, i), Y(p.score), p.elevated ? 4 : 3.2, 0, 7); g.fill(); g.stroke();
  }
  // markers: advisory and hold (only once they have happened)
  drawMarkers(g, w, T, h - B, v, true);
  drawPlayhead(g, w, T - 6, h - B, v);
  drawHover(g, w, T - 6, h - B);
}

function drawMarkers(g, w, top, bot, v, labels) {
  const r = v.r;
  for (const e of r.events) {
    const i = e.part - JOB.firstPart;
    if (i >= v.done) continue;
    if (e.type === 'advisory' || e.type === 'hold' || e.type === 'advisory-repeat') {
      const x = xOf(w, i);
      g.strokeStyle = e.type === 'hold' ? C.crit : C.warn; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
      if (labels) {
        g.fillStyle = e.type === 'hold' ? C.crit : C.warn; g.font = `600 11px ${C.sans}`;
        g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText(e.type === 'hold' ? `Hold ${pid(e.part)}` : `Check setup · ${pid(e.part)}`, x + 5, top);
      }
    }
  }
}
function drawPlayhead(g, w, top, bot, v) {
  const x = xT(w, v.t);
  g.strokeStyle = C.arc; g.lineWidth = 1.5; g.globalAlpha = .9;
  g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); g.globalAlpha = 1;
}
function drawHover(g, w, top, bot) {
  if (S.hover == null) return;
  const x = xOf(w, S.hover);
  g.strokeStyle = 'rgba(240,239,236,.25)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
}

// ------------------------------------------------------------------ timeline / comparison lanes
const NABZ_COL = { ok: '#2b5a2b', watch: '#8f8e85', advise: '#fab219', hold: '#d03b3b' };
function stateOf(p) {
  if (p.rule === 'hold') return 'hold';
  if (p.rule === 'unverified') return 'unverified';
  return p.drift;
}
function drawTimeline(v) {
  const cv = $('tlCv');
  const { g, w, h } = fit(cv);
  const r = v.r, base = OUT.base, rev = revealed();
  const pw = w - GUT - RPAD, cw = pw / N;
  const LA = 30, LB = 98, LH = 24, TS = 5;
  g.font = `12px ${C.sans}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  // lane labels
  g.fillStyle = C.ink; g.fillText(NARROW ? 'No Nabz' : 'Without Nabz', 8, LA + 8);
  g.fillStyle = C.ink3; g.font = `11px ${C.sans}`; if (!NARROW) g.fillText('sampled teardown', 8, LA + 22);
  g.fillStyle = C.ink; g.font = `12px ${C.sans}`; g.fillText(NARROW ? 'Nabz' : 'With Nabz', 8, LB + 8);
  g.fillStyle = C.ink3; g.font = `11px ${C.sans}`;
  if (!NARROW) g.fillText(dec() === 'ignore' ? 'advisory ignored' : dec() === 'act' ? 'operator checks' : 'count + sound', 8, LB + 22);
  $('tlLegend').classList.toggle('on', rev);

  // lane A: nobody knows anything until the teardown
  for (let i = 0; i < N; i++) {
    const x = GUT + i * cw;
    const isDone = i < v.done;
    g.fillStyle = isDone ? '#3a3a37' : '#222220';
    g.fillRect(x + 0.5, LA, Math.max(1, cw - 1), LH);
  }
  const atEnd = v.done >= N;
  if (atEnd && OUT.B.surfaces) {
    const sx = GUT + (OUT.firstBad - JOB.firstPart) * cw;
    hatch(g, sx, LA, GUT + pw - sx, LH, 'rgba(208,59,59,.9)');
    g.strokeStyle = C.crit; g.lineWidth = 1.5; g.strokeRect(GUT + .5, LA - 0.5, pw - 1, LH + 1);
    g.fillStyle = C.ink; g.font = `600 11px ${C.sans}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(`Teardown on ${pid(JOB.lastPart)} fails → ${OUT.B.held} parts quarantined (since last good check ${pid(JOB.lastGoodCheck)}), ${OUT.B.scrapped} scrapped`, GUT + pw / 2, LA - 6);
  } else if (atEnd) {
    g.fillStyle = C.ink2; g.font = `11px ${C.sans}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(`Teardown on ${pid(JOB.lastPart)} passes. Batch released.`, GUT + pw / 2, LA - 6);
  } else {
    g.fillStyle = C.ink3; g.font = `11px ${C.sans}`; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText(`next look inside a weld: teardown on ${pid(JOB.lastPart)} ▾`, GUT + pw, LA - 6);
  }
  // truth strips (only after the teardown reveals them)
  if (rev) {
    for (let i = 0; i < Math.min(v.done, N); i++) {
      const x = GUT + i * cw;
      const tA = base[i].truth, tB = r.parts[i].truth;
      g.fillStyle = tA === 'good' ? '#3d5a3d' : C.crit; g.fillRect(x + .5, LA + LH + 2, Math.max(1, cw - 1), TS);
      g.fillStyle = tB === 'good' ? '#3d5a3d' : C.crit; g.fillRect(x + .5, LB + LH + 2, Math.max(1, cw - 1), TS);
    }
  }
  // lane B: Nabz state per part as it happens
  for (let i = 0; i < N; i++) {
    const x = GUT + i * cw;
    if (i >= v.done) { g.fillStyle = '#222220'; g.fillRect(x + .5, LB, Math.max(1, cw - 1), LH); continue; }
    const st = stateOf(r.parts[i]);
    if (st === 'unverified') { g.fillStyle = '#222220'; g.fillRect(x + .5, LB, cw - 1, LH); hatch(g, x, LB, cw, LH, C.ink3, 3); continue; }
    g.fillStyle = NABZ_COL[st];
    const hh = st === 'ok' ? 6 : st === 'watch' ? 14 : LH;
    g.fillRect(x + .5, LB + LH - hh, Math.max(1, cw - 1), hh);
  }
  // divergence + intervention
  const a = advIdx();
  if (a != null && a < v.done) {
    const x = GUT + (a + 1) * cw;
    g.strokeStyle = C.warn; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, LA - 2); g.lineTo(x, LB + LH + TS + 4); g.stroke();
    g.fillStyle = C.warn; g.font = `600 11px ${C.sans}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    const t = dec() === 'act'
      ? `${pid(a + JOB.firstPart)} · ${endClock(r, a + JOB.firstPart).slice(0, 5)} — operator stops ${r.intervention.minutes} min: ${SCENARIOS[S.scn].benign ? 'no cause found' : 'worn tip replaced'}`
      : dec() === 'ignore' ? `${pid(a + JOB.firstPart)} — advisory raised, operator keeps running` : `${pid(a + JOB.firstPart)} — advisory raised · operator decision pending`;
    const tw = g.measureText(t).width;
    const tx = x + 6 + tw > GUT + pw ? x - 6 - tw : x + 6;
    g.fillText(t, tx, LB - 11);
  }
  // hold labels
  for (const e of r.events) {
    if (e.type !== 'hold') continue;
    const i = e.part - JOB.firstPart;
    if (i >= v.done) continue;
    g.fillStyle = C.crit; g.font = `600 11px ${C.sans}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(`hold ${pid(e.part)}`, GUT + (i + .5) * cw, LB + LH + TS + 5);
  }
  // axis: part numbers + clock
  g.font = `11px ${C.mono}`; g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let i = 9; i < N; i += NARROW ? 30 : 10) {
    const p = JOB.firstPart + i;
    g.fillText(pid(p), GUT + (i + .5) * cw, h - 28);
    g.fillText(clockAt(p).slice(0, 5), GUT + (i + .5) * cw, h - 14);
  }
  drawPlayhead(g, w, 14, h - 32, v);
  drawHover(g, w, 14, h - 32);
}

// ------------------------------------------------------------------ operator panel
const STATE_TEXT = {
  idle: { icon: '·', word: 'Listening', sub: 'Waiting for the first part boundary' },
  ok: { icon: '✓', word: 'Running', sub: 'Arc count and sound within the job baseline' },
  watch: { icon: '~', word: 'Watching', sub: 'Some recent parts sound different. No action yet.' },
  advise: { icon: '!', word: 'Check setup', sub: 'Sustained change in arc sound' },
  hold: { icon: '■', word: 'Hold part', sub: '' },
  unverified: { icon: '?', word: 'Unverified', sub: 'Clamp signal lost on the last part' },
};
let lastKeys = {};
function renderPanel(v) {
  const { r, last } = v;
  const st = last ? stateOf(last) : 'idle';
  const scn = SCENARIOS[S.scn];
  const afterCheck = r.intervention && last && last.part > r.intervention.part;
  const key = [S.scn, dec(), last ? last.part : -1, st, revealed()].join('|');
  if (lastKeys.panel === key) return;
  const prevState = lastKeys.panelState;
  lastKeys.panel = key; lastKeys.panelState = st;
  const T = STATE_TEXT[st];
  const box = $('state');
  box.dataset.s = st;
  if ((st === 'advise' || st === 'hold') && prevState !== st) { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); }
  $('stateIcon').textContent = T.icon;
  $('stateWord').textContent = st === 'hold' ? `Hold part ${pid(last.part)}` : T.word;
  let sub = T.sub, reason = '—', action = 'Continue';
  if (st === 'idle') { $('pPart').textContent = `${pid(v.part.part)} on fixture`; }
  else $('pPart').textContent = pid(last.part) + ' · off fixture ' + endClock(r, last.part);
  if (st === 'ok') {
    reason = `4 of 4 welds · durations in recipe · sound ${last.score.toFixed(2)} ≤ ${BASELINE.threshold.toFixed(2)}`;
    if (afterCheck) {
      reason = scn.benign
        ? `Setup checked at ${pid(r.intervention.part)}: no cause found. Wire lot changed at 0150 — baseline refresh due at the next passed teardown.`
        : `Contact tip replaced at ${pid(r.intervention.part)}. Sound back within baseline.`;
    }
  }
  if (st === 'watch') { reason = `${last.k} of last ${last.n} parts above threshold (rule: ${DETECTOR.adviseK} of ${DETECTOR.window})`; action = 'Continue. Isolated scores do not stop the line.'; }
  if (st === 'advise') {
    const adv = r.advisory;
    const first = r.parts.slice(adv.part - JOB.firstPart - DETECTOR.window + 1, adv.part - JOB.firstPart + 1).find((p) => p.elevated);
    reason = `${adv.k} of last ${adv.n} parts above threshold, first at ${pid(first.part)}. Count and durations still in recipe.`;
    action = 'At the part boundary, check contact tip, nozzle, gas flow and wire feed.';
    sub = dec() === 'ignore' ? 'Advisory open — operator kept running' : T.sub;
  }
  if (st === 'hold') {
    reason = last.reason;
    sub = 'Count rule failed at the part boundary';
    action = `Pull part ${pid(last.part)} before release. Tag for rework.`;
  }
  if (st === 'unverified') { reason = last.reason; action = 'Route this part to normal inspection. Check the clamp.'; }
  $('stateSub').textContent = sub;
  $('pReason').textContent = reason;
  $('pAction').textContent = action;
  renderEvidence(v, st);
  renderDecision(v);
}

function kdots(flags, cls) {
  const pad = Array(Math.max(0, DETECTOR.window - flags.length)).fill(null);
  return `<span class="kdots ${cls || ''}">${[...pad, ...flags].map((f) => `<i class="${f ? 'on' : ''}" ${f == null ? 'style="opacity:.3"' : ''}></i>`).join('')}`;
}
function windowFlags(r, part) {
  // the rolling window as the detector saw it at this part (cleared after a check)
  const i = part - JOB.firstPart;
  const from = r.intervention && part > r.intervention.part ? r.intervention.part - JOB.firstPart + 1 : 0;
  const ps = r.parts.slice(Math.max(from, 0), i + 1).filter((p) => p.score != null).slice(-DETECTOR.window);
  return ps.map((p) => p.elevated);
}
function renderEvidence(v, st) {
  const { r, last } = v;
  const evEl = $('evidence');
  if (!last) {
    evEl.innerHTML = `<div class="ev-h"><span>Sound window</span><span class="muted">rule: ${DETECTOR.adviseK} of last ${DETECTOR.window} parts above threshold</span></div>${kdots([])}</span>
    <div class="caveat">Baseline <span class="mono">${BASELINE.version}</span>, frozen. Threshold <span class="mono">${BASELINE.threshold.toFixed(2)}</span> = 99th percentile of 40 held-out known-good parts × 1.1.</div>`;
    return;
  }
  const adv = r.advisory && last.part >= r.advisory.part ? r.advisory : null;
  if (st === 'hold') {
    const rows = JOB.welds.map((wd, w) => {
      const s = last.arcs[w];
      return `<span class="k">${wd.id} ${wd.name}</span><span class="v" style="color:${s ? C.ink : C.crit}">${s ? s.dur.toFixed(2) + ' s · ' + Math.round(s.amps) + ' A' : 'no arc ≥ 0.3 s'}</span>`;
    }).join('');
    evEl.innerHTML = `<div class="ev-h"><span><b>Evidence</b> · clamp current at the part boundary</span><span class="stamp r">${endClock(r, last.part)} · part ${pid(last.part)}</span></div>
      <div class="ev-grid">${rows}<span class="k">Recipe</span><span class="v">4 arcs · each ≥ 80% of nominal</span></div>
      <div class="caveat">Deterministic rule on arc count and duration. ${adv ? `The sound advisory at ${pid(adv.part)} was still open.` : ''}</div>`;
    return;
  }
  const evPart = adv && st === 'advise' ? r.parts[adv.part - JOB.firstPart] : last;
  const flags = windowFlags(r, evPart.part);
  const kN = flags.filter(Boolean).length;
  const firstElev = (() => {
    const i = evPart.part - JOB.firstPart;
    const ps = r.parts.slice(Math.max(0, i - DETECTOR.window + 1), i + 1);
    const f = ps.find((p) => p.elevated);
    return f ? pid(f.part) : '—';
  })();
  const head = st === 'advise'
    ? `<div class="ev-h"><span><b>Evidence at detection</b></span><span class="stamp">Detected ${endClock(r, adv.part)} · part ${pid(adv.part)} · ${fmtMin(OUT.minuteOf(adv.part))} into the run</span></div>`
    : `<div class="ev-h"><span>Sound window · part ${pid(evPart.part)}</span><span class="muted">rule: ${DETECTOR.adviseK} of last ${DETECTOR.window} → advisory</span></div>`;
  evEl.innerHTML = `${head}
    <div>${kdots(flags, st === 'advise' ? 'advise' : '')}<span class="klabel">${kN} of last ${flags.length} parts above ${BASELINE.threshold.toFixed(2)}</span></span></div>
    <div><div class="ev-h"><span>Band energy vs. known-good welds <span class="muted">· this part, mean over its arcs</span></span><span class="units mono">σ by band, kHz</span></div>
    <canvas id="bandCv" height="96"></canvas></div>
    <div class="ev-grid">
      <span class="k">Part score</span><span class="v">${evPart.score != null ? evPart.score.toFixed(2) : '—'} (threshold ${BASELINE.threshold.toFixed(2)})</span>
      <span class="k">Arc count · durations</span><span class="v">${evPart.arcs ? evPart.arcs.filter(Boolean).length : '—'} of 4 · in recipe</span>
      ${st === 'advise' ? `<span class="k">First elevated in window</span><span class="v">${firstElev}</span>` : ''}
      <span class="k">Baseline</span><span class="v">${BASELINE.version}</span>
    </div>
    ${st === 'advise' ? '<div class="caveat">Unusual sound is not a defect. Nabz asks for a setup check. The bead still passes a visual check, and the teardown stays in the workflow.</div>' : ''}`;
  drawBands(evPart, st === 'advise');
}
function drawBands(p, adv) {
  const cv = document.getElementById('bandCv');
  if (!cv || !p.arcScores) return;
  const { g, w, h } = fit(cv);
  const L = 30, R = 6, T = 6, B = 16, ph = h - T - B, pw = w - L - R;
  const zs = BAND_LABELS.map((_, b) => {
    const a = p.arcScores.filter(Boolean);
    return a.reduce((s, x) => s + x.z[b], 0) / a.length;
  });
  const lim = 4;
  const Y = (z) => T + ph / 2 - (Math.max(-lim, Math.min(lim, z)) / lim) * (ph / 2);
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(L, Y(2), pw, Y(-2) - Y(2));
  g.strokeStyle = C.axis; g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(L + pw, Y(0)); g.stroke();
  g.font = `10px ${C.mono}`; g.fillStyle = C.ink3; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillText('+2', L - 4, Y(2)); g.fillText('−2', L - 4, Y(-2));
  const bw = pw / zs.length;
  zs.forEach((z, b) => {
    const x = L + b * bw + bw * 0.22, ww = bw * 0.56;
    const out = Math.abs(z) > 2;
    g.fillStyle = out ? (adv ? C.warn : C.ink) : C.ink3;
    const y0 = Y(0), y1 = Y(z);
    g.fillRect(x, Math.min(y0, y1), ww, Math.max(1, Math.abs(y1 - y0)));
    g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(BAND_LABELS[b], x + ww / 2, h - B + 3);
  });
}

function renderDecision(v) {
  const box = $('decision');
  const a = advIdx();
  const scn = SCENARIOS[S.scn];
  if (a == null || v.done < a + 1) { box.hidden = true; return; }
  box.hidden = false;
  const d = dec();
  box.classList.toggle('pending', !d);
  const adv = RUNS.act.advisory;
  let result = '';
  if (d === 'act') {
    result = scn.benign
      ? `Operator stopped ${DETECTOR.checkMinutes} min, checked tip, nozzle, gas and feed. <b>No cause found.</b> Logged as an advisory without a cause.`
      : `Operator stopped ${DETECTOR.checkMinutes} min and found the contact-tip bore worn oval. <b>Tip replaced.</b>`;
  } else if (d === 'ignore') {
    result = 'Advisory stays open. The count rule still checks every part.';
  }
  box.innerHTML = `<div class="q">${d ? `Operator decision at part ${pid(adv.part)} <span class="muted" style="font-weight:400">· switch to compare</span>` : `Part ${pid(adv.part)} is off the fixture and looks normal. What does the operator do?`}</div>
    <div class="opts">
      <button class="primary-opt" data-d="act" aria-pressed="${d === 'act'}"><span class="t">Stop &amp; check setup</span><span class="d">≈ ${DETECTOR.checkMinutes} min at the part boundary</span></button>
      <button data-d="ignore" aria-pressed="${d === 'ignore'}"><span class="t">Keep running</span><span class="d">Wait for the ${pid(JOB.lastPart)} teardown</span></button>
    </div>
    ${result ? `<div class="caveat">${result}</div>` : ''}`;
  box.querySelectorAll('button').forEach((b) => b.onclick = () => choose(b.dataset.d));
}
function choose(d) {
  const first = !dec();
  S.decision[S.scn] = d;
  OUT = outcomes(S.scn, d, S.cost);
  traceCache.clear();
  lastKeys = {};
  if (first) play();
}

// ------------------------------------------------------------------ outcome comparison
function renderOutcome(v) {
  const key = [S.scn, dec(), revealed(), JSON.stringify(S.cost), Math.floor(v.t / N * 40)].join('|');
  if (lastKeys.out === key) return;
  lastKeys.out = key;
  const box = $('outcome');
  if (!revealed()) {
    const pct = Math.round((v.t / N) * 100);
    box.innerHTML = `<div class="pending-msg"><span>Outcome resolves at the teardown on part <b class="mono">${pid(JOB.lastPart)}</b> (${clockAt(JOB.lastPart + 1).slice(0, 5)}). Until then the baseline workflow has no information.</span><span class="bar-p"><i style="width:${pct}%"></i></span><span class="mono">${pct}%</span></div>`;
    return;
  }
  const o = OUT, c = S.cost, scn = SCENARIOS[S.scn], d = dec() || 'act';
  const B = o.B, Nn = o.N, r = o.run;
  const surfB = B.surfaces ? `Part ${pid(B.surfaces)} · ${clockAt(B.surfaces + 1).slice(0, 5)}<span class="note">cut-and-etch teardown fails</span>` : `Never<span class="note">teardown on ${pid(JOB.lastPart)} passes</span>`;
  const firstHold = r.events.find((e) => e.type === 'hold');
  const surfN = r.advisory
    ? `Part ${pid(r.advisory.part)} · ${endClock(r, r.advisory.part).slice(0, 5)}<span class="note">amber advisory from arc sound</span>`
    : Nn.unverified ? `—<span class="note">${Nn.unverified} part unverified (clamp dropout) → normal inspection</span>` : '—<span class="note">no advisory, no hold</span>';
  let warn = '—';
  if (o.warningParts != null && B.surfaces) {
    warn = `${o.warningParts} parts · ${fmtMin(o.warningMin)} before the teardown`;
    if (o.leadParts != null) warn += `<span class="note">${o.leadParts} parts · ${fmtMin(o.leadParts * CYC / 60)} before the first defective weld (simulated lead, not measured)</span>`;
  } else if (r.advisory && !B.surfaces) {
    warn = `<span class="note">No defect in this run. The advisory was a false alert.</span>`;
  }
  const actN = r.intervention ? `Stop ${r.intervention.minutes} min · ${scn.benign ? 'no cause found' : 'tip replaced'}` : d === 'ignore' && r.advisory ? `Kept running${firstHold ? ` · held part ${pid(firstHold.part)} at the fixture` : ''}` : Nn.unverified ? `${Nn.unverified} part to normal inspection` : 'None needed';
  const rng = (a, b) => `${pid(a)}–${pid(b)}`;
  const row = (k, a, b) => `<tr><th>${k}</th><td class="colB">${a}</td><td>${b}</td></tr>`;
  const n = (x) => `<span class="mono">${x}</span>`;
  const heldB = B.held ? `${n(B.held)} <span class="note">${rng(JOB.lastGoodCheck + 1, JOB.lastPart)}, since the last good check</span>` : n(0);
  const heldN = Nn.held ? `${n(Nn.held)} <span class="note">${rng(JOB.lastGoodCheck + 1, JOB.lastPart)}</span>` : n(Nn.unverified ? `0 <span class="note">+ ${Nn.unverified} unverified part sorted</span>` : 0);
  const scrB = B.scrapped ? `${n(B.scrapped)} <span class="note">${rng(o.firstBad, JOB.lastPart)}, range bounded by extra sections</span>` : n(0);
  const scrN = Nn.scrapped ? `${n(Nn.scrapped)} <span class="note">${o.nFirstBad ? rng(o.nFirstBad, JOB.lastPart) : ''}</span>` : n(0);
  const lines = (lab, oo, cc) => {
    const parts = [];
    parts.push(`${lab}`);
    parts.push(`  quarantine  ${String(oo.held + (oo.unverified || 0)).padStart(3)} × ${inr(c.sortPerHeldPart).padEnd(5)}      = ${inr(cc.hold)}`);
    parts.push(`  scrap       ${String(oo.scrapped).padStart(3)} × ${inr(c.scrapPerPart).padEnd(5)}      = ${inr(cc.scrap)}`);
    parts.push(`  stop        ${String(oo.stopMin).padStart(3)} min × ${inr(o.perMin)}/min = ${inr(cc.stop)}`);
    parts.push(`  <span class="hl">total                          ${inr(cc.total)}</span>`);
    return parts.join('\n');
  };
  const avoided = o.avoided;
  let verdict;
  if (avoided > 0) verdict = 'avoidable in this run';
  else if (avoided < 0) verdict = scn.benign ? 'cost of one false alert' : 'extra cost in this run';
  else verdict = d === 'ignore' && r.advisory ? 'nothing saved — the warning was ignored' : 'difference in this run';
  box.innerHTML = `
    <div>
      <h3>Same run, two workflows</h3>
      <table class="cmp">
        <thead><tr><th></th><th>Without Nabz</th><th>With Nabz · ${r.advisory ? (d === 'act' ? 'operator checks' : 'operator keeps running') : 'no advisory'}</th></tr></thead>
        <tbody>
          ${row('First signal', surfB, surfN)}
          ${row('Warning time', '—', warn)}
          ${row('Operator action', B.surfaces ? 'Containment after the teardown' : 'None', actN)}
          ${row('Parts quarantined', heldB, heldN)}
          ${row('Parts scrapped', scrB, scrN)}
          ${row('Station stop', n(B.stopMin + ' min'), n(Nn.stopMin + ' min'))}
          <tr class="total"><th>Cost of this run</th><td class="n">${inr(o.bc.total)}</td><td class="n">${inr(o.nc.total)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h3>Where the number comes from</h3>
      <div class="big ${avoided <= 0 ? 'neg' : ''}">${inr(avoided)}</div>
      <div class="muted" style="margin:-2px 0 10px">${verdict} · ${inr(o.bc.total)} − ${inr(o.nc.total)}</div>
      <div class="calc">${lines('Without Nabz', B, o.bc)}\n${lines('With Nabz', Nn, o.nc)}\n\n<span class="muted">stop ₹/min = (60 s ÷ ${CYC} s) parts/min × ${inr(c.marginPerPart)} margin = ${inr(o.perMin)}
containment stop = ${c.containmentMinutes} min · inputs editable under Assumptions</span></div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">One simulated event on synthetic telemetry. Target hardware: ₹10,000–15,000 per station (docs.md). Lead time and false-alert rate are pilot measurements, not results.</p>
    </div>`;
}

// ------------------------------------------------------------------ teardown macro
function macroSVG(defect) {
  const parts = [`<svg viewBox="0 0 290 150" role="img" aria-label="${defect ? 'Section with lack of fusion and porosity' : 'Sound fillet weld section'}">`];
  parts.push('<rect x="10" y="98" width="270" height="30" fill="#5d5a54"/>');            // base plate
  parts.push('<rect x="102" y="18" width="22" height="80" fill="#5d5a54"/>');           // upright
  // fusion zone and fillet
  const pen = defect ? 2 : 9;
  parts.push(`<path d="M124 ${98 - 46} L124 98 L170 98 Z" fill="#7d7468"/>`);
  parts.push(`<path d="M124 52 Q ${124 - pen} 75 ${124 - pen * 0.6} 98 Q 147 ${98 + pen} 170 98" fill="none" stroke="#a89b88" stroke-width="1.4"/>`);
  parts.push(`<path d="M124 52 L170 98" stroke="#8e8576" stroke-width="2"/>`);
  for (let i = 0; i < 9; i++) parts.push(`<path d="M${128 + i * 4} ${96 - i * 4.3} q 6 3 10 0" stroke="#6a6257" fill="none" stroke-width=".8"/>`);
  if (defect) {
    parts.push('<path d="M124.5 60 L124.5 97 L132 98" stroke="#0b0b0b" stroke-width="2.4" fill="none"/>');
    for (const [x, y, r] of [[136, 84, 2.6], [145, 90, 1.8], [140, 74, 1.5], [150, 82, 2.1], [131, 90, 1.4]]) parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#0b0b0b"/>`);
    parts.push(`<path d="M126 70 L 196 40" stroke="${C.crit}" stroke-width="1"/><text x="198" y="38" fill="${C.crit}" font-size="10" font-family="${C.sans}">lack of fusion</text>`);
    parts.push(`<path d="M150 82 L 196 62" stroke="${C.crit}" stroke-width="1"/><text x="198" y="60" fill="${C.crit}" font-size="10" font-family="${C.sans}">porosity</text>`);
  } else {
    parts.push(`<text x="176" y="58" fill="${C.ink3}" font-size="10" font-family="${C.sans}">full fusion</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
let macroDismissed = {};
function renderMacro(v) {
  const box = $('macro');
  const show = v.t >= N && !macroDismissed[S.scn + dec()];
  const key = [show, S.scn, dec()].join('|');
  if (lastKeys.macro === key) return;
  lastKeys.macro = key;
  box.hidden = !show;
  if (!show) return;
  const lastB = OUT.base[N - 1], lastN = run().parts[N - 1];
  const m = (title, truth) => `<div class="m"><div class="m-h"><span>${title}</span><span class="verdict ${truth === 'good' ? 'pass' : 'fail'}">${truth === 'good' ? 'PASS' : 'FAIL'}</span></div>${macroSVG(truth !== 'good')}</div>`;
  box.innerHTML = `${m(`Without Nabz · part ${pid(JOB.lastPart)} · W3 section`, lastB.truth)}${m(`With Nabz · part ${pid(JOB.lastPart)} · W3 section`, lastN.truth)}
   <button class="ghost close" id="macroClose">Hide</button>`;
  $('macroClose').onclick = () => { macroDismissed[S.scn + dec()] = true; lastKeys.macro = null; };
}

// ------------------------------------------------------------------ tooltip
function renderTip(clientX, cvEl) {
  const tip = $('tip');
  if (S.hover == null) { tip.hidden = true; return; }
  const v = view();
  const i = S.hover, r = v.r, p = r.parts[i], b = OUT.base[i];
  const known = i < v.done;
  const rows = [];
  const tr = (k, val) => rows.push(`<div class="tr"><span>${k}</span><span>${val}</span></div>`);
  if (!known) tr('Status', 'not yet welded');
  else {
    tr('Sound score', p.score != null ? `${p.score.toFixed(2)} ${p.elevated ? '▲' : ''}` : 'no signal');
    tr('Window', `${p.k} of ${p.n} elevated`);
    tr('Arcs', p.arcs ? `${p.arcs.filter(Boolean).length} of 4` : '—');
    if (p.arcs) tr('Durations', p.arcs.map((a) => (a ? a.dur.toFixed(1) : '—')).join(' · ') + ' s');
    tr('Nabz', ({ ok: 'running', watch: 'watching', advise: 'check setup', hold: 'HOLD', unverified: 'unverified' })[stateOf(p)]);
    tr('Without Nabz', v.done >= N && OUT.B.surfaces ? 'quarantined' : 'uninspected');
    if (revealed()) {
      const lab = { good: 'sound', defect: 'lack of fusion', missing: 'W3 missing' };
      tr('Inside (no Nabz)', lab[b.truth]);
      if (r.intervention) tr('Inside (Nabz)', lab[p.truth]);
    }
  }
  tip.innerHTML = `<div class="th">Part ${pid(p.part)} · ${clockAt(p.part).slice(0, 5)}</div>${rows.join('')}`;
  tip.hidden = false;
  const host = $('tlCv').closest('.timeline');
  const hr = host.getBoundingClientRect();
  const cr = cvEl.getBoundingClientRect();
  let x = clientX - hr.left + 14;
  if (x + 210 > hr.width) x = clientX - hr.left - 220;
  tip.style.left = x + 'px';
  tip.style.top = (cr.top - hr.top + (cvEl.id === 'scoreCv' ? -150 : 10)) + 'px';
}

// ------------------------------------------------------------------ draw loop
function draw(ts) {
  NARROW = $('tlCv').clientWidth < 640;
  GUT = NARROW ? 74 : 132;
  const v = view();
  drawStage(v, ts);
  drawTrace(v);
  drawScore(v);
  drawTimeline(v);
  renderPanel(v);
  renderOutcome(v);
  renderMacro(v);
  const pb = $('playBtn');
  const waiting = advIdx() != null && !dec() && S.t >= advIdx() + 1;
  pb.textContent = S.playing ? '❚❚' : '▶';
  pb.setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
  pb.classList.toggle('paused-at', waiting);
  pb.title = waiting ? 'Choose the operator action first' : '';
}

// ------------------------------------------------------------------ controls
function scrubFrom(cv, ev) {
  const r = cv.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const w = r.width;
  setT(((x - GUT) / (w - GUT - RPAD)) * N);
}
function bindScrub(cv) {
  let drag = false;
  cv.addEventListener('pointerdown', (e) => { drag = true; cv.setPointerCapture(e.pointerId); pause(); scrubFrom(cv, e); });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    S.hover = x > GUT ? iOfX(r.width, x) : null;
    if (drag) scrubFrom(cv, e);
    renderTip(e.clientX, cv);
  });
  cv.addEventListener('pointerup', () => { drag = false; });
  cv.addEventListener('pointerleave', () => { S.hover = null; renderTip(0, cv); });
}
function setScenario(id) {
  S.scn = id; S.t = 0.2; pause();
  compute();
  renderSeg();
}
function renderSeg() {
  const seg = $('scnSeg');
  seg.innerHTML = Object.values(SCENARIOS).map((s) => `<button role="radio" aria-checked="${s.id === S.scn}" data-id="${s.id}" title="${s.story}">${s.short}<span class="sub">${s.id === 'healthy' ? 'control' : s.id === 'fault' ? 'fault' : 'borderline'}</span></button>`).join('');
  seg.querySelectorAll('button').forEach((b) => b.onclick = () => setScenario(b.dataset.id));
  const sp = $('speedSeg');
  sp.innerHTML = SPEEDS.map((s) => `<button role="radio" aria-checked="${s === S.speed}" title="${s.title}" data-id="${s.id}">${s.label}</button>`).join('');
  sp.querySelectorAll('button').forEach((b) => b.onclick = () => { S.speed = SPEEDS.find((s) => s.id === b.dataset.id); renderSeg(); });
  $('thrLabel').textContent = `threshold ${BASELINE.threshold.toFixed(2)} · baseline ${BASELINE.version}`;
  $('briefScn').textContent = `Scenario: ${SCENARIOS[S.scn].label}`;
}
function reset() {
  S.t = 0.2; pause();
  delete S.decision[S.scn]; delete S.revealed[S.scn];
  for (const k of Object.keys(S.holdPaused)) if (k.startsWith(S.scn)) delete S.holdPaused[k];
  for (const k of Object.keys(macroDismissed)) if (k.startsWith(S.scn)) delete macroDismissed[k];
  OUT = outcomes(S.scn, 'act', S.cost);
  lastKeys = {};
}

// ------------------------------------------------------------------ assumptions drawer
function renderDrawer() {
  const c = S.cost;
  const inp = (k) => `<input type="number" min="0" step="1" data-k="${k}" value="${c[k]}">`;
  $('drawerBody').innerHTML = `
  <p>Everything on this page is a simulation: synthetic telemetry, a fictional supplier and fictional part numbers. The detector logic is real code running on that synthetic data. Nothing here is a measured Nabz result.</p>
  <h4>What exists today (docs.md)</h4>
  <table>
    <tr><td>Missed / short weld at the part boundary</td><td><span class="status-pill">staged concept</span></td></tr>
    <tr><td>Sound drift advisory</td><td><span class="status-pill">illustrative</span></td></tr>
    <tr><td>Lead time, false alerts per shift</td><td><span class="status-pill">unmeasured</span></td></tr>
    <tr><td>Traceability log</td><td><span class="status-pill">proposed</span></td></tr>
    <tr><td>Diagnosis of the cause</td><td><span class="status-pill">later work</span></td></tr>
  </table>
  <h4>Cost inputs (editable, fictional)</h4>
  <table>
    <tr><td>Scrap value per bracket (material + processing)</td><td>₹ ${inp('scrapPerPart')}</td></tr>
    <tr><td>Quarantine handling + visual sort per held part</td><td>₹ ${inp('sortPerHeldPart')}</td></tr>
    <tr><td>Contribution margin per part (lost when the station stops)</td><td>₹ ${inp('marginPerPart')}</td></tr>
    <tr><td>Containment stop after a failed teardown</td><td>${inp('containmentMinutes')} min</td></tr>
    <tr><td>Operator setup check after an advisory</td><td>${DETECTOR.checkMinutes} min</td></tr>
  </table>
  <p style="font-size:12px">Sort cost ≈ 10 min of an inspector at ~₹150/h loaded (Haryana skilled minimum ≈ ₹13,000–13,700/month in 2025, roughly doubled for overhead). Scrap and margin are placeholders for a pilot to replace.</p>
  <h4>Process (fictional job)</h4>
  <table>
    <tr><td>Cycle time · parts in the interval</td><td>${CYC} s · ${N}</td></tr>
    <tr><td>Teardown interval · sampled part</td><td>every ${N} parts · last of the interval</td></tr>
    <tr><td>Process</td><td style="white-space:normal">${JOB.process}</td></tr>
    ${JOB.welds.map((w) => `<tr><td>${w.id} ${w.name}</td><td>${w.dur.toFixed(1)} s · ${w.amps} A</td></tr>`).join('')}
    <tr><td>Recipe rule</td><td>4 arcs, each ≥ 80% of nominal</td></tr>
  </table>
  <h4>Detector (as implemented in engine.js)</h4>
  <table>
    <tr><td>Arc segmentation</td><td>on ${DETECTOR.ampsOn} A · off ${DETECTOR.ampsOff} A · dwell ≥ ${DETECTOR.minDwell} s</td></tr>
    <tr><td>Audio features</td><td>${DETECTOR.bands} band energies per arc</td></tr>
    <tr><td>Arc score</td><td>RMS robust z vs. median/MAD</td></tr>
    <tr><td>Part score</td><td>median of its arcs</td></tr>
    <tr><td>Baseline</td><td>${DETECTOR.baselineParts} known-good parts, per weld position, frozen</td></tr>
    <tr><td>Threshold</td><td>p99 of ${DETECTOR.validationParts} held-out good parts × 1.1 = ${BASELINE.threshold.toFixed(2)}</td></tr>
    <tr><td>Watch · advisory</td><td>${DETECTOR.watchK} · ${DETECTOR.adviseK} of last ${DETECTOR.window} parts</td></tr>
  </table>
  <h4>Synthetic signal model</h4>
  <ul>
    <li><b>Worn contact tip.</b> The bore wears oval, the wire wanders, and the arc gets less stable before feeding fails. Simulated as more high-band energy and more variance in arc sound, more current ripple, and a burnback that stops W3 on part 0184. Internal lack of fusion begins once wear passes a set severity (part 0175 here).</li>
    <li><b>Wire lot change.</b> A small, steady shift in arc sound with welds still in spec. docs.md calls for a new baseline when the wire changes; this run skips that step on purpose.</li>
    <li><b>Grinder nearby.</b> One loud arc. The part score uses the median of its four arcs, so it does not count.</li>
    <li><b>Clamp dropout.</b> No current, so no arc windows and no audio scoring. The part is marked unverified, not held.</li>
  </ul>
  <h4>Sources</h4>
  <ul>
    <li>docs.md and README.md in this repository (mechanism, status, part 0184, pricing target).</li>
    <li>Stemmer et al., <a href="https://arxiv.org/abs/2409.02290" target="_blank" rel="noopener">Unsupervised welding defect detection using audio and video</a> (Intel, 2024) shows that weld audio carries defect signals. Their AUCs are Intel’s results on robotic welds, not Nabz’s.</li>
    <li>Rohe et al., <a href="https://doaj.org/article/dbd1a86babec4432a10e4faeb1f54dde" target="_blank" rel="noopener">shielding-gas flow detection from weld audio</a> (J. Manuf. Mater. Process., 2021).</li>
    <li><a href="https://studio.edgeimpulse.com/public/47648/latest/acquisition/training" target="_blank" rel="noopener">Belgian Welding Institute sound weld clips</a> on Edge Impulse, the planned first audio baseline.</li>
    <li>Bernard / Tregaskiss, <a href="https://bernardtregaskiss.com/understanding-and-extending-contact-tip-life" target="_blank" rel="noopener">Understanding and extending contact tip life</a>: burnback, unstable arcs and feed problems from tip wear.</li>
    <li>Miller, <a href="https://www.millerwelds.com/resources/article-library/mig-welding-101" target="_blank" rel="noopener">MIG welding 101</a>: current ranges by wire size and short-circuit transfer.</li>
    <li>Assembly Magazine, <a href="https://www.assemblymag.com/articles/95740-parts-quarantine-and-recovery" target="_blank" rel="noopener">Parts quarantine and recovery</a>: how quarantine and sorting costs arise.</li>
    <li><a href="https://www.siam.in/siam-voluntary-recall" target="_blank" rel="noopener">SIAM recall register</a>: Volkswagen/Škoda, Oct 2024, suspected missed weld seam on a track control arm.</li>
    <li><a href="https://wageindicator.org/en-in/work-in-india/minimum-wage/17192-haryana/17487-shops-and-commercial-establishments" target="_blank" rel="noopener">WageIndicator · Haryana minimum wage</a> for the labour-rate assumption.</li>
  </ul>`;
  $('drawerBody').querySelectorAll('input').forEach((i) => i.oninput = () => {
    const val = Math.max(0, Number(i.value) || 0);
    S.cost[i.dataset.k] = val;
    OUT = outcomes(S.scn, dec() || 'act', S.cost);
    lastKeys.out = null;
  });
}
function toggleDrawer(open) {
  const d = $('drawer');
  d.classList.toggle('open', open);
  d.setAttribute('aria-hidden', String(!open));
  $('assumpBtn').setAttribute('aria-expanded', String(open));
}

// ------------------------------------------------------------------ boot
function boot() {
  compute();
  renderSeg();
  renderDrawer();
  bindScrub($('tlCv'));
  bindScrub($('scoreCv'));
  $('playBtn').onclick = () => (S.playing ? pause() : play());
  $('resetBtn').onclick = reset;
  $('startBtn').onclick = () => { $('brief').hidden = true; S.started = true; S.t = 0; play(); };
  $('assumpBtn').onclick = () => toggleDrawer(!$('drawer').classList.contains('open'));
  $('drawerClose').onclick = () => toggleDrawer(false);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (!$('brief').hidden) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('startBtn').click(); } return; }
    if (e.key === ' ') { e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') { pause(); setT(Math.floor(S.t + 1e-9) + 1); }
    else if (e.key === 'ArrowLeft') { pause(); setT(Math.ceil(S.t - 1e-9) - 1); }
    else if (e.key === 'r' || e.key === 'R') reset();
    else if (e.key === 'Escape') toggleDrawer(false);
  });
  // test hook for automated checks
  window.__nabz = { S, view, choose, setT, setScenario, reset, outcomes: () => OUT, runs: () => RUNS };
  requestAnimationFrame(tick);
}
boot();
