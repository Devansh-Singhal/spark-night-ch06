// Nabz simulation UI. Every view is a function of (scenario, operator policy, playhead t)
// and the deterministic run from engine.js. Nothing here invents results.
import {
  JOB, DETECTOR, PRESETS, FAULT_INFO, BAND_LABELS, BASELINE, COST_DEFAULTS,
  runScenario, outcomes, currentTrace, segmentArcs, clockAt, pid, minuteOf,
} from './engine.js';
import { createStation } from './scene3d.js';
import { bindFullscreen } from './fullscreen.js';

const N = JOB.lastPart - JOB.firstPart + 1;
const CYC = JOB.cycleSec;
const START_T = 0.15;
const $ = (id) => document.getElementById(id);
const C = {
  ink: '#17191c', ink2: '#4b4e54', ink3: '#868990', grid: '#eeede8', axis: '#d6d5cf', soft: '#f3f3f0',
  ok: '#0c8a0c', okLane: '#a9d4a9', warn: '#fab219', warnInk: '#8a5a00', crit: '#d03b3b', accent: '#2a78d6',
  idle: '#f0efeb', done: '#d9d8d2', good: '#cfe3cf', font: '"Inter", system-ui, sans-serif',
};
const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const fmtMin = (m) => `${(Math.round(m * 10) / 10).toFixed(1)} min`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ------------------------------------------------------------------ state
const SPEEDS = [
  { id: 'slow', label: 'Slow', pps: 1 / 24, title: 'Watch every weld · 2× process speed' },
  { id: 'normal', label: 'Normal', pps: 1.2, title: 'About a part a second' },
  { id: 'fast', label: 'Fast', pps: 4, title: 'Four parts a second' },
];
const S = {
  scn: 'fault', t: START_T, playing: false, seeking: false, speed: SPEEDS[0],
  policy: {}, revealed: {}, pausedAt: new Set(), cost: { ...COST_DEFAULTS },
  hover: null, sandbox: [], labels: true,
};
let RUNS = {}, OUT = null, yMax = 4, keys = {};
const scenario = () => (S.scn === 'sandbox' ? { ...PRESETS.sandbox, faults: S.sandbox } : PRESETS[S.scn]);
const policy = () => S.policy[S.scn] || null;
// before the operator decides, nothing has been done yet: show the branch without a check
const run = () => RUNS[policy() || 'ignore'];
const revealed = () => !!S.revealed[S.scn];
const firstAdv = () => RUNS.act.advisory;
const advIdx = () => (firstAdv() ? firstAdv().part - JOB.firstPart : null);
function waitingForDecision() {
  const a = advIdx();
  return a != null && !policy() && S.t >= a + 1;
}
const extraMin = (r, p) => r.interventions.filter((c) => c.part < p).length * DETECTOR.checkMinutes;
const startClock = (r, p) => clockAt(p, extraMin(r, p));
const endClock = (r, p) => clockAt(p + 1, extraMin(r, p));

function compute() {
  const sc = scenario();
  RUNS = { act: runScenario(sc, 'act'), ignore: runScenario(sc, 'ignore') };
  OUT = outcomes(sc, policy() || 'act', S.cost);
  yMax = Math.max(4, ...RUNS.ignore.parts.map((p) => p.score || 0), ...RUNS.act.parts.map((p) => p.score || 0)) * 1.08;
  traceCache.clear();
  keys = {};
}

// ------------------------------------------------------------------ playback
let lastTs = null;
function frame(ts) {
  const dt = lastTs == null ? 0 : Math.min(0.06, (ts - lastTs) / 1000);
  lastTs = ts;
  if (S.playing) advance(dt * (S.seeking ? 10 : S.speed.pps));
  draw();
  requestAnimationFrame(frame);
}
function eventStops(r) {
  const stops = new Set();
  for (const e of r.events) if (e.type !== 'check') stops.add(e.part - JOB.firstPart + 1);
  return [...stops].sort((a, b) => a - b);
}
function advance(dp) {
  let t = S.t + dp;
  const a = advIdx();
  if (a != null && !policy() && t >= a + 1) { t = a + 1; stop(); }
  const r = run();
  for (const b of eventStops(r)) {
    if (S.t < b && t >= b) {
      const ev = r.events.find((e) => e.part - JOB.firstPart + 1 === b && e.type !== 'check');
      const key = `${S.scn}:${policy()}:${b}`;
      if (S.seeking || (ev && ev.type === 'hold' && !S.pausedAt.has(key))) { t = b; S.pausedAt.add(key); stop(); break; }
    }
  }
  if (t >= N) { t = N; S.revealed[S.scn] = true; stop(); }
  S.t = t;
}
function stop() { S.playing = false; S.seeking = false; }
function play() {
  if (waitingForDecision()) return;
  if (S.t >= N) S.t = START_T;
  S.playing = true;
}
function seekNext() {
  if (waitingForDecision()) return;
  if (S.t >= N) S.t = START_T;
  S.playing = true; S.seeking = true;
}
function setT(t) {
  const a = advIdx();
  if (a != null && !policy() && t > a + 1) t = a + 1;
  S.t = Math.max(0, Math.min(N, t));
  if (S.t >= N) S.revealed[S.scn] = true;
}

// ------------------------------------------------------------------ derived view state
function view() {
  const r = run();
  const t = S.t;
  const done = Math.min(N, Math.floor(t + 1e-9));
  const idx = Math.min(N - 1, done);
  const phase = t >= N ? 1 : t - idx;
  const last = done > 0 ? r.parts[done - 1] : null;
  const atBoundary = done > 0 && (t >= N || phase < 1e-6);
  const live = !S.playing || (!S.seeking && S.speed.pps < 0.5);
  let sIdx, sSec;
  if (atBoundary) { sIdx = done - 1; sSec = CYC; }
  else if (live) { sIdx = idx; sSec = phase * CYC; }
  else { sIdx = done > 0 ? done - 1 : 0; sSec = done > 0 ? CYC : phase * CYC; }
  return { r, t, done, phase, last, live, sIdx, sSec, part: r.parts[sIdx] };
}
const stateOf = (p) => (p.rule === 'hold' ? 'hold' : p.rule === 'unverified' ? 'unverified' : p.drift);

// ------------------------------------------------------------------ clamp current trace
const traceCache = new Map();
function traceFor(r, i) {
  const key = `${r.policy}:${i}`;
  if (!traceCache.has(key)) {
    const p = r.parts[i];
    traceCache.set(key, p.dropped ? null : currentTrace(p.part, p.severity, p.missed));
  }
  return traceCache.get(key);
}
function weldTimes(p, w, tr) {
  if (p.arcs && p.arcs[w]) return p.arcs[w];
  if (!tr && !p.missed.includes(w)) { const wd = JOB.welds[w]; return { start: wd.start, end: wd.start + wd.dur, dur: wd.dur }; }
  return null;
}

// ------------------------------------------------------------------ canvas helpers
function fit(cv) {
  const dpr = window.devicePixelRatio || 1;
  const h = +cv.getAttribute('height');
  const w = cv.clientWidth;
  if (cv._w !== w || cv._dpr !== dpr) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px'; cv._w = w; cv._dpr = dpr;
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
let GUT = 120, NARROW = false;
const RP = 16;
const xOf = (w, i) => GUT + ((i + 0.5) / N) * (w - GUT - RP);
const xT = (w, t) => GUT + (t / N) * (w - GUT - RP);
const iOfX = (w, x) => Math.max(0, Math.min(N - 1, Math.floor(((x - GUT) / (w - GUT - RP)) * N)));
function hatch(g, x, y, w, h, color, gap = 5) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = color; g.lineWidth = 1.2;
  for (let k = -h; k < w + h; k += gap) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.stroke(); }
  g.restore();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

// ------------------------------------------------------------------ 3D station
let station = null;
function stageState(v) {
  const p = v.part, sec = v.sSec;
  const tr = traceFor(v.r, v.sIdx);
  const beads = [0, 0, 0, 0], missed = [false, false, false, false];
  const timings = JOB.welds.map((_, w) => weldTimes(p, w, tr));
  let arc = null;
  JOB.welds.forEach((wd, w) => {
    const tm = timings[w];
    if (!tm) { if (sec > wd.start + wd.dur) missed[w] = true; return; }
    if (sec >= tm.end) beads[w] = 1;
    else if (sec >= tm.start) { beads[w] = (sec - tm.start) / tm.dur; arc = { w, frac: beads[w] }; }
  });
  if (!v.live) arc = null;
  const ph = phoneModel(v);
  return { beads, missed, arc, timings, live: v.live, dropped: !tr, phone: ph, phoneKey: JSON.stringify(ph), tr, sec };
}
function drawStage(v) {
  const st = stageState(v);
  station.update(st);
  const amps = st.tr ? Math.round(st.tr[Math.min(st.tr.length - 1, Math.floor(st.sec * DETECTOR.sampleHz))]) : null;
  setText('hudPart', pid(v.part.part));
  setText('hudWeld', st.arc ? `${JOB.welds[st.arc.w].id} ${JOB.welds[st.arc.w].name}` : v.live ? (st.sec < 8 ? 'Loading part' : st.sec > 34 ? 'Unloading' : 'Moving') : 'Time-lapse');
  setText('hudAmps', amps == null ? 'no signal' : `${st.arc ? amps : Math.min(amps, 3)} A`);
  setText('hudClock', startClock(v.r, v.part.part).slice(0, 5));
  setText('vpMode', v.live ? '' : 'Time-lapse: showing each finished part. Pause or pick Slow to watch the welds.');
  return st;
}
function setText(id, t) { const e = $(id); if (e.textContent !== t) e.textContent = t; }

// ------------------------------------------------------------------ current trace
function drawTrace(v, st) {
  const { g, w, h } = fit($('trace'));
  const L = 40, R = 8, T = 18, B = 18, pw = w - L - R, ph = h - T - B;
  const X = (s) => L + (s / CYC) * pw, Y = (a) => T + ph - (a / 230) * ph;
  g.font = `11px ${C.font}`;
  g.strokeStyle = C.grid; g.lineWidth = 1; g.fillStyle = C.ink3; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const a of [0, 100, 200]) { g.beginPath(); g.moveTo(L, Y(a)); g.lineTo(w - R, Y(a)); g.stroke(); g.fillText(`${a} A`, L - 6, Y(a)); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let s = 0; s <= CYC; s += pw < 500 ? 12 : 6) g.fillText(`${s} s`, X(s), h - B + 4);
  const p = v.part, sec = st.sec;
  JOB.welds.forEach((wd, wi) => {
    const slot = p.arcs ? p.arcs[wi] : null;
    const missed = p.arcs && !slot && sec > wd.start + wd.dur;
    const seen = slot && sec >= slot.end;
    g.fillStyle = missed ? 'rgba(208,59,59,.08)' : 'rgba(23,25,28,.03)';
    rr(g, X(wd.start) - 2, T, X(wd.start + wd.dur) - X(wd.start) + 4, ph, 4); g.fill();
    if (missed) { g.setLineDash([4, 3]); g.strokeStyle = C.crit; g.lineWidth = 1; rr(g, X(wd.start) - 2, T, X(wd.start + wd.dur) - X(wd.start) + 4, ph, 4); g.stroke(); g.setLineDash([]); }
    g.fillStyle = missed ? C.crit : seen ? C.ink : C.ink3; g.textAlign = 'left'; g.textBaseline = 'top';
    g.font = `${seen || missed ? 600 : 500} 11px ${C.font}`;
    g.fillText(missed ? `${wd.id} · no arc` : seen && pw >= 460 ? `${wd.id} · ${slot.dur.toFixed(2)} s` : wd.id, X(wd.start) - 2, 2);
  });
  g.setLineDash([3, 3]); g.strokeStyle = '#b7b9bd'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(L, Y(DETECTOR.ampsOn)); g.lineTo(w - R, Y(DETECTOR.ampsOn)); g.stroke(); g.setLineDash([]);
  const tr = st.tr;
  if (!tr) {
    g.fillStyle = C.ink2; g.font = `500 13px ${C.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('No clamp signal for this part', L + pw / 2, T + ph / 2);
    return;
  }
  const hz = DETECTOR.sampleHz;
  const k = Math.min(tr.length, Math.floor(sec * hz) + 1);
  g.strokeStyle = C.accent; g.lineWidth = 1.3; g.lineJoin = 'round'; g.beginPath();
  for (let i = 0; i < k; i++) { const x = X(i / hz), y = Y(tr[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  if (sec < CYC) { g.strokeStyle = 'rgba(42,120,214,.35)'; g.beginPath(); g.moveTo(X(sec), T); g.lineTo(X(sec), T + ph); g.stroke(); }
}

// ------------------------------------------------------------------ score chart
function drawScore(v) {
  const { g, w, h } = fit($('scoreCv'));
  const T = 22, B = 22, ph = h - T - B;
  const Y = (s) => T + ph - (Math.min(s, yMax) / yMax) * ph;
  const r = v.r, thr = BASELINE.threshold;
  g.font = `11px ${C.font}`;
  g.strokeStyle = C.grid; g.fillStyle = C.ink3; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineWidth = 1;
  for (let s = 0; s <= yMax; s += 1) { g.beginPath(); g.moveTo(GUT, Y(s)); g.lineTo(w - RP, Y(s)); g.stroke(); g.fillText(s.toFixed(0), GUT - 8, Y(s)); }
  g.fillStyle = 'rgba(12,138,12,.045)'; g.fillRect(GUT, Y(thr), w - GUT - RP, Y(0) - Y(thr));
  g.setLineDash([5, 4]); g.strokeStyle = C.ink2; g.beginPath(); g.moveTo(GUT, Y(thr)); g.lineTo(w - RP, Y(thr)); g.stroke(); g.setLineDash([]);
  g.textAlign = 'left'; g.font = `500 11.5px ${C.font}`; g.fillStyle = C.ink2;
  g.fillText(NARROW ? 'alert' : 'alert threshold', 0, Y(thr));
  g.fillStyle = C.ink3; g.font = `11px ${C.font}`;
  if (!NARROW) { g.fillText('sounds like', 0, Y(thr * 0.3) - 7); g.fillText('good welds', 0, Y(thr * 0.3) + 7); g.fillText('sounds different', 0, Y(thr + (yMax - thr) * 0.45)); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let i = 9; i < N; i += NARROW ? 30 : 10) g.fillText(pid(JOB.firstPart + i), xOf(w, i), h - B + 6);

  // counterfactual after a check (shown once the run has been completed once)
  const ghost = RUNS.ignore;
  if (revealed() && r.intervention && r !== ghost) {
    const from = r.intervention.part - JOB.firstPart + 1;
    g.strokeStyle = '#b4b7bc'; g.lineWidth = 1.2;
    for (let i = from; i < v.done; i++) { const s = ghost.parts[i].score; if (s == null) continue; g.beginPath(); g.arc(xOf(w, i), Y(s), 3.2, 0, 7); g.stroke(); }
    g.fillStyle = C.ink2; g.font = `11.5px ${C.font}`; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('○ same run if nobody had checked', w - RP, 2);
  }
  // per-arc scores (faint) and part scores
  for (let i = 0; i < Math.min(v.done + 1, N); i++) {
    const p = r.parts[i];
    if (!p.arcScores) continue;
    p.arcScores.forEach((a, wi) => {
      if (!a) return;
      if (i >= v.done && (!v.live || !p.arcs[wi] || v.sSec < p.arcs[wi].end || v.sIdx !== i)) return;
      g.fillStyle = 'rgba(75,78,84,.22)';
      g.beginPath(); g.arc(xOf(w, i), Y(a.score), 1.7, 0, 7); g.fill();
      if (a.score > yMax) { g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('▲', xOf(w, i), T - 14); }
    });
  }
  for (let i = 0; i < v.done; i++) {
    const p = r.parts[i];
    const age = Math.min(1, (v.t - (i + 1)) * 3 + 0.25);
    g.globalAlpha = age;
    if (p.score == null) { g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('×', xOf(w, i), Y(0) - 2); g.globalAlpha = 1; continue; }
    g.fillStyle = p.elevated ? C.ink : '#8d9096';
    g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(xOf(w, i), Y(p.score), p.elevated ? 4.2 : 3.3, 0, 7); g.fill(); g.stroke();
    g.globalAlpha = 1;
  }
  // markers
  for (const e of r.events) {
    const i = e.part - JOB.firstPart;
    if (i >= v.done || (e.type !== 'advisory' && e.type !== 'hold')) continue;
    const x = xOf(w, i);
    g.strokeStyle = e.type === 'hold' ? C.crit : C.warn; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, T - 4); g.lineTo(x, h - B); g.stroke();
    g.fillStyle = e.type === 'hold' ? C.crit : C.warnInk; g.font = `600 11.5px ${C.font}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(e.type === 'hold' ? `Hold ${pid(e.part)}` : `Check setup · ${pid(e.part)}`, x + 6, T - 6);
  }
  playhead(g, w, T - 8, h - B, v);
}
function playhead(g, w, top, bot, v) {
  const x = xT(w, v.t);
  g.strokeStyle = C.accent; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
  g.fillStyle = C.accent; g.beginPath(); g.arc(x, top, 3.5, 0, 7); g.fill();
  if (S.hover != null) {
    const hx = xOf(w, S.hover);
    g.strokeStyle = 'rgba(23,25,28,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(hx, top); g.lineTo(hx, bot); g.stroke();
  }
}

// ------------------------------------------------------------------ comparison lanes
const LANE = { ok: C.okLane, watch: '#a3a6ab', advise: C.warn, hold: C.crit };
function drawLanes(v) {
  const { g, w, h } = fit($('tlCv'));
  const r = v.r, base = OUT.base.parts, rev = revealed();
  const pw = w - GUT - RP, cw = pw / N;
  const LA = 22, LB = 78, LH = 22, TS = 5;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = C.ink; g.font = `600 12.5px ${C.font}`;
  g.fillText(NARROW ? 'Today' : 'Without Nabz', 0, LA + 7);
  g.fillText(NARROW ? 'Nabz' : 'With Nabz', 0, LB + 7);
  g.fillStyle = C.ink3; g.font = `11.5px ${C.font}`;
  if (!NARROW) { g.fillText('teardown only', 0, LA + 21); g.fillText(policy() === 'ignore' ? 'advisory ignored' : 'operator checks', 0, LB + 21); }
  for (let i = 0; i < N; i++) {
    const x = GUT + i * cw;
    g.fillStyle = i < v.done ? C.done : C.idle;
    g.fillRect(x + 0.5, LA, Math.max(1, cw - 1), LH);
  }
  const atEnd = v.done >= N;
  g.font = `500 11.5px ${C.font}`; g.textBaseline = 'bottom';
  if (atEnd && OUT.B.teardownFails) {
    const sx = GUT + (OUT.B.firstBad - JOB.firstPart) * cw;
    hatch(g, sx, LA, GUT + pw - sx, LH, 'rgba(208,59,59,.85)');
    g.strokeStyle = C.crit; g.lineWidth = 1.5; g.strokeRect(GUT + 0.5, LA - 0.5, pw - 1, LH + 1);
    g.fillStyle = C.crit; g.textAlign = 'center';
    g.fillText(`Teardown on ${pid(JOB.lastPart)} fails → ${OUT.B.held} parts quarantined, ${OUT.B.scrapped} scrapped`, GUT + pw / 2, LA - 4);
  } else if (atEnd) {
    g.fillStyle = OUT.B.escaped ? C.crit : C.ink2; g.textAlign = 'center';
    g.fillText(OUT.B.escaped ? `Teardown on ${pid(JOB.lastPart)} passes, but ${plural(OUT.B.escaped, 'bad part')} shipped` : `Teardown on ${pid(JOB.lastPart)} passes · batch released`, GUT + pw / 2, LA - 4);
  } else {
    g.fillStyle = C.ink3; g.textAlign = 'right';
    g.fillText(NARROW ? `teardown at ${pid(JOB.lastPart)}` : `nobody looks inside a weld until the teardown on ${pid(JOB.lastPart)}`, GUT + pw, LA - 4);
  }
  if (rev) {
    for (let i = 0; i < v.done; i++) {
      const x = GUT + i * cw;
      g.fillStyle = base[i].truth === 'good' ? C.good : C.crit; g.fillRect(x + 0.5, LA + LH + 3, Math.max(1, cw - 1), TS);
      g.fillStyle = r.parts[i].truth === 'good' ? C.good : C.crit; g.fillRect(x + 0.5, LB + LH + 3, Math.max(1, cw - 1), TS);
    }
  }
  for (let i = 0; i < N; i++) {
    const x = GUT + i * cw;
    if (i >= v.done) { g.fillStyle = C.idle; g.fillRect(x + 0.5, LB, Math.max(1, cw - 1), LH); continue; }
    const s = stateOf(r.parts[i]);
    if (s === 'unverified') { g.fillStyle = C.idle; g.fillRect(x + 0.5, LB, cw - 1, LH); hatch(g, x, LB, cw, LH, '#9a9da3', 3); continue; }
    g.fillStyle = LANE[s];
    const hh = s === 'ok' ? 7 : s === 'watch' ? 13 : LH;
    g.fillRect(x + 0.5, LB + LH - hh, Math.max(1, cw - 1), hh);
  }
  // checks / divergence
  r.interventions.forEach((c, n) => {
    const i = c.part - JOB.firstPart;
    if (i >= v.done) return;
    const x = GUT + (i + 1) * cw;
    g.strokeStyle = C.warn; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, LA - 2); g.lineTo(x, LB + LH + TS + 5); g.stroke();
    if (n === 0) {
      g.fillStyle = C.warnInk; g.font = `600 11.5px ${C.font}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const t = `${pid(c.part)} · operator checks ${c.minutes} min · ${c.found ? 'worn tip replaced' : 'nothing found'}`;
      const tw = g.measureText(t).width;
      g.fillText(t, x + 6 + tw > GUT + pw ? x - 6 - tw : x + 6, LB - 12);
    }
  });
  const a = advIdx();
  if (a != null && a < v.done && !r.intervention) {
    const x = GUT + (a + 1) * cw;
    g.strokeStyle = C.warn; g.lineWidth = 2; g.beginPath(); g.moveTo(x, LB - 4); g.lineTo(x, LB + LH + TS + 5); g.stroke();
    g.fillStyle = C.warnInk; g.font = `600 11.5px ${C.font}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(policy() === 'ignore' ? `${pid(a + JOB.firstPart)} · advisory, operator keeps running` : `${pid(a + JOB.firstPart)} · advisory · your call`, x + 6, LB - 12);
  }
  for (const e of r.events) {
    if (e.type !== 'hold') continue;
    const i = e.part - JOB.firstPart;
    if (i >= v.done) continue;
    g.fillStyle = C.crit; g.font = `600 11px ${C.font}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(`hold ${pid(e.part)}`, GUT + (i + 0.5) * cw, LB + LH + TS + 6);
  }
  g.font = `11px ${C.font}`; g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let i = 9; i < N; i += NARROW ? 30 : 10) g.fillText(clockAt(JOB.firstPart + i).slice(0, 5), GUT + (i + 0.5) * cw, h - 14);
  playhead(g, w, 8, h - 18, v);
}

// ------------------------------------------------------------------ app panel + narration
const ICONS = {
  ok: '<svg viewBox="0 0 20 20"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  watch: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" fill="currentColor"/><path d="M2.5 10s3-5 7.5-5 7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  advise: '<svg viewBox="0 0 20 20"><path d="M10 5v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="10" cy="14.6" r="1.4" fill="currentColor"/></svg>',
  hold: '<svg viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8" rx="1.5" fill="currentColor"/></svg>',
  unverified: '<svg viewBox="0 0 20 20"><path d="M7.5 7.5a2.6 2.6 0 115 .9c-.6.8-2.5 1.4-2.5 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.8" r="1.2" fill="currentColor"/></svg>',
  idle: '<svg viewBox="0 0 20 20"><path d="M7 5l8 5-8 5z" fill="currentColor"/></svg>',
};
function appModel(v) {
  const { r, last } = v;
  const s = last ? stateOf(last) : 'idle';
  const recentCheck = last && r.interventions.filter((c) => c.part < last.part).slice(-1)[0];
  const m = { state: s, icon: { ok: '✓', watch: '~', advise: '!', hold: '■', unverified: '?', idle: '▶' }[s] };
  if (s === 'idle') Object.assign(m, { title: v.t > START_T ? 'First part in progress' : 'Ready', sub: 'Waiting for the first weld count', part: `${pid(v.part.part)} on the fixture`, reason: '—', action: '—' });
  if (s === 'ok') Object.assign(m, { title: 'Running', sub: 'Welds and sound look normal', part: pid(last.part), reason: `4 of 4 welds, right length. Sound ${last.score.toFixed(2)}, under ${BASELINE.threshold.toFixed(2)}.`, action: 'Keep going' });
  if (s === 'ok' && recentCheck && last.part - recentCheck.part <= 8) m.reason = recentCheck.found ? `Tip replaced at ${pid(recentCheck.part)}. Sound back to normal.` : `Checked at ${pid(recentCheck.part)}, no cause found.`;
  if (s === 'watch') Object.assign(m, { title: 'Watching', sub: 'A few parts sound different', part: pid(last.part), reason: `${last.k} of the last ${last.n} parts above the threshold.`, action: 'Keep going. One-off sounds do not stop the line.' });
  if (s === 'advise') {
    const adv = [...r.advisories].reverse().find((a) => a.part <= last.part);
    Object.assign(m, { title: 'Check setup', sub: policy() === 'ignore' ? 'Still open: operator kept running' : 'The arc sounds different, and it is lasting', part: pid(adv.part), reason: `${adv.k} of the last ${adv.n} parts sound different. All welds are present and the right length.`, action: 'At the next part change, check the contact tip, nozzle, gas flow and wire feed.' });
  }
  if (s === 'hold') Object.assign(m, { title: `Hold part ${pid(last.part)}`, sub: 'Weld count failed', part: pid(last.part), reason: last.reason, action: `Take part ${pid(last.part)} off the line before it is released.` });
  if (s === 'unverified') Object.assign(m, { title: 'Unverified', sub: 'No clamp signal on the last part', part: pid(last.part), reason: last.reason, action: 'Send this part to normal inspection. Check the clamp.' });
  return m;
}
function phoneModel(v) {
  const m = appModel(v);
  return { state: m.state, icon: m.icon, title: m.title, sub: m.sub, part: m.part, reason: m.reason, action: m.action };
}
function renderApp(v) {
  const m = appModel(v);
  const k = JSON.stringify(m);
  if (keys.app === k) return;
  keys.app = k;
  $('app').dataset.s = m.state;
  $('sIcon').innerHTML = ICONS[m.state];
  setText('sTitle', m.title); setText('sSub', m.sub);
  setText('fPart', m.part); setText('fReason', m.reason); setText('fAction', m.action);
}

function narrate(v) {
  const { r, last } = v;
  const s = last ? stateOf(last) : 'idle';
  const recentCheck = last && r.interventions.filter((c) => c.part < last.part).slice(-1)[0];
  if (v.done >= N) {
    const B = OUT.B, Nn = OUT.N;
    let points;
    if (B.teardownFails && !Nn.teardownFails) points = [
      `Without Nabz, the teardown finds bad welds and ${B.held} parts go into quarantine.`,
      `With the setup check at part ${pid(r.intervention.part)}, the teardown passes.`,
    ];
    else if (B.teardownFails) points = [
      'The operator kept running. Both workflows end in a failed teardown and quarantine.',
      `Nabz still held ${plural(Nn.heldAtStation, 'part')} at the fixture.`,
    ];
    else if (B.escaped) points = [
      `The teardown sample passed. Without Nabz, ${plural(B.escaped, 'bad part')} would have shipped.`,
      `Nabz held ${plural(Nn.heldAtStation, 'part')} at the fixture.`,
    ];
    else if (r.advisories.length) points = ['The welds were sound.', 'The setup check found no fault. This was a false alert.'];
    else points = ['The welds were sound.', 'Nabz finished the run without a setup advisory.'];
    return { title: `Teardown on part ${pid(JOB.lastPart)}`, points, steps: [4] };
  }
  if (s === 'idle') return { title: 'What you are looking at', points: [
    'Station 02 makes one bracket with four welds every 48 seconds.',
    'A clamp on the welding cable lets Nabz count welds and time each one.',
    'A phone listens during each weld. Nabz compares the sound with known-good welds from this job.',
  ], steps: [] };
  if (s === 'hold') return { title: `Why part ${pid(last.part)} is held`, points: [
    last.reason,
    'The welds missed the recipe requirements. Nabz asks the operator to hold this bracket at the fixture.',
  ], steps: [1, 4], evidence: 'hold' };
  if (s === 'unverified') return { title: 'Clamp signal lost', points: [
    `Nabz cannot count the welds on part ${pid(last.part)}.`,
    'The bracket goes to normal inspection. The line keeps running.',
  ], steps: [1] };
  if (s === 'advise') {
    if (policy() === 'ignore' && last.part > r.advisory.part) return { title: 'Advisory still open', points: [
      'The operator kept running. Nabz continues to count each weld.',
      'The weld sound is still different from the known-good welds.',
    ], steps: [4], evidence: 'advise' };
    return { title: 'Nabz recommends a setup check', points: [
      `${r.advisory.k} of the last ${r.advisory.n} parts sound different from known-good welds.`,
      'All four welds are present, the right length, and still look normal.',
    ], steps: [3, 4], evidence: 'advise' };
  }
  if (recentCheck && last.part - recentCheck.part <= 10) {
    return recentCheck.found
      ? { title: 'Fixed early', points: [
        `The operator replaced the worn contact tip during a ${recentCheck.minutes}-minute stop.`,
        'The weld sound returned to its usual range.',
      ], steps: [4] }
      : { title: 'Setup check found no fault', points: [
        'The new wire spool is within spec and sounds different from the original spool.',
        `The alert cost a ${recentCheck.minutes}-minute stop. Refreshing the sound baseline after a wire change can help.`,
      ], steps: [4] };
  }
  if (s === 'watch') return { title: 'Nabz is watching the sound', points: [
    `${last.k} of the last ${last.n} parts sound different from the known-good welds.`,
    `Nabz asks for a setup check when ${DETECTOR.adviseK} of the last ${DETECTOR.window} parts sound different.`,
  ], steps: [3], evidence: 'window' };
  const loudArc = last.arcScores && last.arcScores.some((a) => a && a.score > BASELINE.threshold * 2.5) && !last.elevated;
  if (loudArc) return { title: 'One loud weld', points: [
    `One weld on part ${pid(last.part)} was unusually loud, as can happen when a grinder runs nearby.`,
    'Nabz uses the middle of the four weld scores, so the part stayed below the alert threshold.',
  ], steps: [3], evidence: 'window' };
  return { title: 'Running normally', points: [
    'The last bracket has four welds of the right length.',
    'Its sound is within the usual range for this job.',
  ], steps: v.live ? [1, 2] : [3], evidence: 'window' };
}

function windowFlags(r, part) {
  const i = part - JOB.firstPart;
  const lastCheck = r.interventions.filter((c) => c.part <= part).slice(-1)[0];
  const from = lastCheck && lastCheck.part < part ? lastCheck.part - JOB.firstPart + 1 : 0;
  return r.parts.slice(from, i + 1).filter((p) => p.score != null).slice(-DETECTOR.window).map((p) => p.elevated);
}
const kdots = (flags, cls = '') => `<span class="kdots ${cls}">${[...Array(Math.max(0, DETECTOR.window - flags.length)).fill(null), ...flags].map((f) => `<i class="${f ? 'on' : ''}"></i>`).join('')}</span>`;

function renderExplain(v) {
  const n = narrate(v);
  const r = v.r;
  const evPart = n.evidence === 'advise' ? r.parts[r.advisory.part - JOB.firstPart] : v.last;
  const k = [n.title, ...n.points, n.evidence, evPart && evPart.part, policy(), revealed()].join('|');
  document.querySelectorAll('#how li').forEach((li) => li.classList.toggle('on', n.steps.includes(+li.dataset.step)));
  station.setHighlight(n.steps.includes(1) && n.evidence === 'hold' ? 'clamp' : n.steps.includes(3) || n.evidence === 'advise' ? 'phone' : null);
  if (keys.ex === k) return;
  keys.ex = k;
  setText('exTitle', n.title);
  $('exBody').replaceChildren(...n.points.map((point) => {
    const li = document.createElement('li');
    li.textContent = point;
    return li;
  }));
  const ev = $('evidence');
  if (n.evidence === 'window' && evPart) {
    const f = windowFlags(r, evPart.part);
    ev.innerHTML = `<div class="ev-row">${kdots(f)}<span>${f.filter(Boolean).length} of the last ${f.length} parts above the threshold. An advisory needs ${DETECTOR.adviseK}.</span></div>`;
  } else if (n.evidence === 'advise') {
    const f = windowFlags(r, evPart.part);
    ev.innerHTML = `<div class="ev-box">
      <div class="row-title"><b>Evidence at detection</b><span class="ev-stamp">${endClock(r, evPart.part)} · part ${pid(evPart.part)} · ${fmtMin(minuteOf(evPart.part))} into the run</span></div>
      <div class="ev-row" style="margin:6px 0 8px">${kdots(f, 'advise')}<span>${f.filter(Boolean).length} of ${f.length} parts above ${BASELINE.threshold.toFixed(2)}</span></div>
      <div class="row-title"><b style="font-size:12.5px;font-weight:500">Where the sound changed</b><span>energy by frequency band vs. good welds</span></div>
      <canvas id="bandCv" height="86"></canvas>
      <div class="ev-grid" style="margin-top:8px"><span class="k">Welds</span><span>4 of 4, all the right length</span><span class="k">Baseline</span><span>${BASELINE.version}</span><span class="k">Caveat</span><span>An unusual sound is not a defect. It is a reason to check the setup.</span></div>
    </div>`;
    drawBands(evPart);
  } else if (n.evidence === 'hold') {
    ev.innerHTML = `<div class="ev-box"><div class="row-title"><b>Arcs measured on part ${pid(v.last.part)}</b><span class="ev-stamp r">${endClock(r, v.last.part)}</span></div><div class="ev-grid">${JOB.welds.map((wd, w) => {
      const s = v.last.arcs[w];
      return `<span class="k">${wd.id} ${wd.name}</span><span style="color:${s ? C.ink : C.crit};font-weight:${s ? 400 : 600}">${s ? `${s.dur.toFixed(2)} s at ${Math.round(s.amps)} A` : 'no arc'}</span>`;
    }).join('')}</div></div>`;
  } else ev.innerHTML = '';
  renderDecision(v);
}
function drawBands(p) {
  const cv = $('bandCv');
  if (!cv || !p.arcScores) return;
  const { g, w, h } = fit(cv);
  const L = 26, R = 4, T = 4, B = 16, ph = h - T - B, pw = w - L - R;
  const zs = BAND_LABELS.map((_, b) => { const a = p.arcScores.filter(Boolean); return a.reduce((s, x) => s + x.z[b], 0) / a.length; });
  const lim = 4;
  const Y = (z) => T + ph / 2 - (Math.max(-lim, Math.min(lim, z)) / lim) * (ph / 2);
  g.fillStyle = 'rgba(12,138,12,.06)'; g.fillRect(L, Y(2), pw, Y(-2) - Y(2));
  g.strokeStyle = C.axis; g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(L + pw, Y(0)); g.stroke();
  g.font = `10px ${C.font}`; g.fillStyle = C.ink3; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillText('+2σ', L - 3, Y(2)); g.fillText('−2σ', L - 3, Y(-2));
  const bw = pw / zs.length;
  zs.forEach((z, b) => {
    const x = L + b * bw + bw * 0.2, ww = bw * 0.6;
    g.fillStyle = Math.abs(z) > 2 ? C.warn : '#b9bbc0';
    const y0 = Y(0), y1 = Y(z);
    rr(g, x, Math.min(y0, y1), ww, Math.max(1.5, Math.abs(y1 - y0)), 2); g.fill();
    g.fillStyle = C.ink3; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(BAND_LABELS[b] + (b === 7 ? ' kHz' : ''), x + ww / 2, h - B + 3);
  });
}
function renderDecision(v) {
  const box = $('decision');
  const a = advIdx();
  if (a == null || v.done < a + 1) { box.hidden = true; return; }
  box.hidden = false;
  const d = policy();
  const res = !d ? '' : d === 'act'
    ? (RUNS.act.intervention.found ? 'The operator stops for 3 minutes and finds the contact tip worn. It gets replaced.' : 'The operator stops for 3 minutes, checks everything and finds nothing wrong.')
    : 'The advisory stays open. Nabz still checks the weld count on every part.';
  box.innerHTML = `<div class="q">${d ? 'Operator decision' : `Part ${pid(firstAdv().part)} looks fine. What should the operator do?`}</div>
    <div class="opts">
      <button class="rec" data-d="act" aria-pressed="${d === 'act'}"><span class="t">Stop and check</span><span class="d">About 3 minutes</span></button>
      <button data-d="ignore" aria-pressed="${d === 'ignore'}"><span class="t">Keep running</span><span class="d">Wait for the teardown at ${pid(JOB.lastPart)}</span></button>
    </div>${res ? `<div class="res">${res} ${revealed() ? '' : 'Select Resume or Next event to continue.'}</div>` : ''}`;
  box.querySelectorAll('button').forEach((b) => (b.onclick = () => choose(b.dataset.d)));
}
function choose(d) {
  S.policy[S.scn] = d;
  OUT = outcomes(scenario(), d, S.cost);
  traceCache.clear();
  keys = {};
}

// ------------------------------------------------------------------ outcome
function renderOutcome(v) {
  const k = [S.scn, policy(), revealed(), JSON.stringify(S.cost), Math.round((v.t / N) * 50), S.sandbox.length].join('|');
  if (keys.out === k) return;
  keys.out = k;
  const box = $('outcome');
  if (!revealed()) {
    const pct = Math.round((v.t / N) * 100);
    box.innerHTML = `<h2>What it is worth</h2><div class="pending"><span>The result shows up at the teardown on part ${pid(JOB.lastPart)}. Until then, nobody without Nabz knows anything is wrong.</span><span class="bar"><i style="width:${pct}%"></i></span><span>${pct}%</span></div>`;
    return;
  }
  const o = OUT, c = S.cost, r = o.run, B = o.B, Nn = o.N;
  const d = policy() || 'act';
  const firstHold = r.events.find((e) => e.type === 'hold');
  const surfB = B.teardownFails ? `Part ${pid(JOB.lastPart)} · ${clockAt(JOB.lastPart + 1).slice(0, 5)}<span class="note">teardown fails</span>` : `Never<span class="note">teardown passes${B.escaped ? ', bad parts ship' : ''}</span>`;
  const surfN = Nn.surfaces ? `Part ${pid(Nn.surfaces)} · ${endClock(r, Nn.surfaces).slice(0, 5)}<span class="note">${Nn.surfaceType === 'hold' ? 'part held at the fixture' : 'setup check advisory'}</span>` : '—<span class="note">nothing to report</span>';
  let warn = '—';
  if (o.warningParts != null) {
    warn = `${o.warningParts} parts · ${fmtMin(o.warningMin)} earlier`;
    if (o.leadParts != null) warn += `<span class="note">${o.leadParts} parts (${fmtMin((o.leadParts * CYC) / 60)}) before the first bad weld. Simulated, not measured.</span>`;
  } else if (r.advisory && !B.teardownFails && !B.escaped) warn = '<span class="note">No defect in this run, so this advisory was a false alert.</span>';
  const act = r.interventions.length ? `${plural(r.interventions.length, 'check')} · ${r.interventions.some((x) => x.found) ? 'worn tip replaced' : 'nothing found'}` : d === 'ignore' && r.advisory ? `Kept running${firstHold ? ` · part ${pid(firstHold.part)} held` : ''}` : Nabzline(Nn);
  const showEsc = B.escaped || Nn.escaped;
  const row = (label, a, b) => `<tr><th>${label}</th><td>${a}</td><td class="nabz">${b}</td></tr>`;
  const qB = B.held ? `${B.held}<span class="note">${pid(JOB.lastGoodCheck + 1)}–${pid(JOB.lastPart)}, everything since the last good check</span>` : '0';
  const qN = Nn.held ? `${Nn.held}<span class="note">${pid(JOB.lastGoodCheck + 1)}–${pid(JOB.lastPart)}</span>` : Nn.unverified ? `0<span class="note">+ ${plural(Nn.unverified, 'unverified part')} sent to inspection</span>` : '0';
  const sB = B.scrapped ? `${B.scrapped}<span class="note">${pid(B.firstBad)}–${pid(JOB.lastPart)}</span>` : '0';
  const sN = Nn.scrapped ? `${Nn.scrapped}<span class="note">${Nn.teardownFails ? `${pid(Nn.firstBad)}–${pid(JOB.lastPart)}` : 'held at the fixture'}</span>` : '0';
  const avoided = o.avoided;
  const verdict = avoided > 0 ? 'saved in this run' : avoided < 0 ? (r.advisories.length && !B.teardownFails && !B.escaped ? 'the cost of one false alert' : 'extra cost in this run') : d === 'ignore' && r.advisory ? 'saved, because the warning was ignored' : 'difference in this run';
  const lines = (label, oo, cc) => `
    <tr><td class="grp" colspan="2">${label}</td></tr>
    <tr><td>Quarantine · ${oo.held + oo.unverified} × ${inr(c.sortPerHeldPart)}</td><td class="r">${inr(cc.hold)}</td></tr>
    <tr><td>Scrap · ${oo.scrapped} × ${inr(c.scrapPerPart)}</td><td class="r">${inr(cc.scrap)}</td></tr>
    <tr><td>Station stop · ${oo.stopMin} min × ${inr(o.perMin)}</td><td class="r">${inr(cc.stop)}</td></tr>
    ${showEsc ? `<tr><td>Shipped bad · ${oo.escaped} × ${inr(c.escapePerPart)}</td><td class="r">${inr(cc.escape)}</td></tr>` : ''}
    <tr class="sub"><td>Total</td><td class="r">${inr(cc.total)}</td></tr>`;
  const lastB = o.base.parts[N - 1].truth, lastN = r.parts[N - 1].truth;
  box.innerHTML = `
    <h2>What it is worth</h2>
    <p class="lede">The same welds, the same noise, the same teardown. The only difference is whether anyone was listening.</p>
    <div class="out-grid">
      <div>
        <table class="cmp">
          <thead><tr><th></th><th>Without Nabz</th><th>With Nabz${r.advisory ? ` · ${d === 'act' ? 'operator checks' : 'operator keeps running'}` : ''}</th></tr></thead>
          <tbody>
            ${row('Problem found', surfB, surfN)}
            ${row('Warning', '—', warn)}
            ${row('Action taken', B.teardownFails ? 'Containment after the teardown' : 'None', act)}
            ${row('Parts quarantined', qB, qN)}
            ${row('Parts scrapped', sB, sN)}
            ${showEsc ? row('Bad parts shipped', String(B.escaped), String(Nn.escaped)) : ''}
            ${row('Station stopped', `${B.stopMin} min`, `${Nn.stopMin} min`)}
            <tr class="total"><th>Cost</th><td>${inr(o.bc.total)}</td><td class="nabz">${inr(o.nc.total)}</td></tr>
          </tbody>
        </table>
        <div class="sections">
          <div class="section"><div class="h"><span>Without Nabz · cut-and-etch of part ${pid(JOB.lastPart)}, W3</span><span class="verdict ${lastB === 'good' ? 'pass' : 'fail'}">${lastB === 'good' ? 'PASS' : 'FAIL'}</span></div>${sectionSVG(lastB !== 'good')}</div>
          <div class="section"><div class="h"><span>With Nabz · cut-and-etch of part ${pid(JOB.lastPart)}, W3</span><span class="verdict ${lastN === 'good' ? 'pass' : 'fail'}">${lastN === 'good' ? 'PASS' : 'FAIL'}</span></div>${sectionSVG(lastN !== 'good')}</div>
        </div>
      </div>
      <div>
        <div class="save"><span class="big ${avoided <= 0 ? 'neg' : ''}">${inr(avoided)}</span><span class="muted">${verdict}</span></div>
        <div class="calc"><table>${lines('Without Nabz', B, o.bc)}${lines('With Nabz', Nn, o.nc)}</table>
          <div class="foot">Station stop costs ${inr(o.perMin)} a minute: ${(60 / CYC).toFixed(2)} parts a minute × ${inr(c.marginPerPart)} margin. A failed teardown adds a ${c.containmentMinutes}-minute containment stop. Every input is editable under Method &amp; assumptions.</div></div>
        <p class="muted small" style="margin:12px 0 0">One simulated event on synthetic data. Target hardware is ₹10,000–15,000 per station. Real lead time and false-alert rates are what a pilot would measure.</p>
      </div>
    </div>`;
}
function Nabzline(Nn) { return Nn.heldAtStation ? `${plural(Nn.heldAtStation, 'part')} held at the fixture` : Nn.unverified ? `${plural(Nn.unverified, 'part')} sent to inspection` : 'None needed'; }

function sectionSVG(defect) {
  const s = ['<svg viewBox="0 0 300 120" role="img" aria-label="Weld cross-section">'];
  s.push('<rect x="10" y="80" width="280" height="26" rx="2" fill="#d4d6d9"/><rect x="110" y="8" width="20" height="72" rx="1" fill="#d4d6d9"/>');
  s.push('<path d="M130 38 L130 80 L172 80 Z" fill="#b9b2a6"/>');
  const pen = defect ? 2 : 8;
  s.push(`<path d="M130 38 Q ${130 - pen} 60 ${130 - pen * 0.6} 80 Q 151 ${80 + pen} 172 80" fill="none" stroke="#8f877a" stroke-width="1.2"/>`);
  for (let i = 0; i < 8; i++) s.push(`<path d="M${134 + i * 4} ${77 - i * 4.5} q6 3 10 0" stroke="#9c9486" fill="none" stroke-width=".8"/>`);
  if (defect) {
    s.push('<path d="M130.6 46 L130.6 79 L138 80" stroke="#2b2e33" stroke-width="2.2" fill="none"/>');
    for (const [x, y, r] of [[142, 68, 2.4], [151, 73, 1.7], [146, 59, 1.4], [156, 66, 2], [137, 74, 1.3]]) s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#2b2e33"/>`);
    s.push(`<path d="M132 56 L200 32" stroke="${C.crit}"/><text x="203" y="35" fill="${C.crit}" font-size="11" font-family="Inter, sans-serif">lack of fusion</text>`);
    s.push(`<path d="M156 66 L200 54" stroke="${C.crit}"/><text x="203" y="57" fill="${C.crit}" font-size="11" font-family="Inter, sans-serif">porosity</text>`);
  } else s.push(`<text x="182" y="46" fill="#6b6f76" font-size="11" font-family="Inter, sans-serif">full fusion at the root</text>`);
  s.push('</svg>');
  return s.join('');
}

// ------------------------------------------------------------------ sandbox
const INJECT = [
  { kind: 'wear', t: 'Wear the contact tip', d: 'Arc slowly gets less stable' },
  { kind: 'skip', t: 'Skip a weld', d: 'W2 is never made', weld: 1 },
  { kind: 'noise', t: 'Grinder nearby', d: 'One very loud arc', weld: 1 },
  { kind: 'dropout', t: 'Unplug the clamp', d: 'One part with no signal' },
  { kind: 'lot', t: 'Load a new wire lot', d: 'In spec, sounds a bit different' },
];
function nextPart(v) { return JOB.firstPart + v.done + (v.phase > 1e-6 ? 1 : 0); }
function renderSandbox() {
  const on = S.scn === 'sandbox';
  $('sandbox').hidden = !on;
  if (!on) return;
  $('inject').innerHTML = INJECT.map((x, i) => `<button data-i="${i}"><b>${x.t}</b><span>${x.d}</span></button>`).join('');
  $('inject').querySelectorAll('button').forEach((b) => (b.onclick = () => {
    const x = INJECT[+b.dataset.i];
    const at = nextPart(view());
    if (at > JOB.lastPart) return;
    S.sandbox.push({ kind: x.kind, at, ...(x.weld != null ? { weld: x.weld } : {}) });
    compute(); renderSandbox();
  }));
  $('injected').innerHTML = S.sandbox.map((f, i) => `<span class="chip">${FAULT_INFO[f.kind].short} · ${f.kind === 'wear' || f.kind === 'lot' ? 'from' : 'on'} ${pid(f.at)}<button data-i="${i}" aria-label="Remove">×</button></span>`).join('') || '<span class="muted small">No faults yet. The station is healthy.</span>';
  $('injected').querySelectorAll('button').forEach((b) => (b.onclick = () => { S.sandbox.splice(+b.dataset.i, 1); compute(); renderSandbox(); }));
}

// ------------------------------------------------------------------ tooltip
function renderTip(clientX, cv) {
  const tip = $('tip');
  if (S.hover == null) { tip.hidden = true; return; }
  const v = view(), i = S.hover, r = v.r, p = r.parts[i], b = OUT.base.parts[i];
  const rows = [];
  const tr = (k, val) => rows.push(`<div class="tr"><span>${k}</span><span>${val}</span></div>`);
  if (i >= v.done) tr('Status', 'not welded yet');
  else {
    tr('Sound score', p.score != null ? p.score.toFixed(2) + (p.elevated ? ' · above' : '') : 'no signal');
    tr('Welds counted', p.arcs ? `${p.arcs.filter(Boolean).length} of 4` : '—');
    tr('Nabz', { ok: 'running', watch: 'watching', advise: 'check setup', hold: 'hold', unverified: 'unverified' }[stateOf(p)]);
    if (revealed()) {
      const lab = { good: 'sound', defect: 'lack of fusion', missing: 'weld missing' };
      tr('Inside the weld', lab[p.truth] + (r.intervention && b.truth !== p.truth ? ` (${lab[b.truth]} without Nabz)` : ''));
    }
  }
  tip.innerHTML = `<div class="th">Part ${pid(p.part)} · ${clockAt(p.part).slice(0, 5)}</div>${rows.join('')}`;
  tip.hidden = false;
  const host = cv.closest('.run').getBoundingClientRect(), cr = cv.getBoundingClientRect();
  let x = clientX - host.left + 14;
  if (x + 230 > host.width) x = clientX - host.left - 236;
  tip.style.left = `${x}px`;
  tip.style.top = `${cr.top - host.top + 26}px`;
}

// ------------------------------------------------------------------ frame
function draw() {
  NARROW = $('tlCv').clientWidth < 640;
  GUT = NARROW ? 54 : 120;
  const v = view();
  const st = drawStage(v);
  drawTrace(v, st);
  drawScore(v);
  drawLanes(v);
  renderApp(v);
  renderExplain(v);
  renderOutcome(v);
  const waiting = waitingForDecision();
  $('playBtn').classList.toggle('wait', waiting);
  $('nextBtn').disabled = waiting;
  $('playIcon').setAttribute('d', S.playing ? 'M5 4h3.5v12H5zM11.5 4H15v12h-3.5z' : 'M6 4l10 6-10 6z');
  $('playIcon').parentElement.toggleAttribute('hidden', waiting);
  setText('playLabel', waiting ? 'Choose an action' : S.playing ? 'Pause' : S.t >= N ? 'Replay' : S.t > START_T ? 'Resume' : 'Start simulation');
  setText('progressTxt', `${v.done} of ${N} parts`);
}

// ------------------------------------------------------------------ controls
function bindScrub(cv) {
  let drag = false;
  const at = (e) => { const r = cv.getBoundingClientRect(); return ((e.clientX - r.left - GUT) / (r.width - GUT - RP)) * N; };
  cv.addEventListener('pointerdown', (e) => { drag = true; cv.setPointerCapture(e.pointerId); stop(); setT(at(e)); });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    S.hover = x > GUT ? iOfX(r.width, x) : null;
    if (drag) setT(at(e));
    renderTip(e.clientX, cv);
  });
  cv.addEventListener('pointerup', () => { drag = false; });
  cv.addEventListener('pointerleave', () => { S.hover = null; renderTip(0, cv); });
}
function setScenario(id) {
  S.scn = id; S.t = START_T; stop();
  compute(); renderTabs(); renderSandbox();
  $('introText').textContent = PRESETS[id].intro;
}
function renderTabs() {
  const tabs = [['fault', 'Worn contact tip'], ['healthy', 'Healthy'], ['borderline', 'Wire lot change'], ['sandbox', 'Sandbox']];
  $('tabs').innerHTML = tabs.map(([id, l]) => `<button role="tab" aria-selected="${id === S.scn}" data-id="${id}">${l}</button>`).join('');
  $('tabs').querySelectorAll('button').forEach((b) => (b.onclick = () => setScenario(b.dataset.id)));
  $('speedSeg').innerHTML = SPEEDS.map((s) => `<button role="radio" aria-checked="${s === S.speed}" data-id="${s.id}" title="${s.title}">${s.label}</button>`).join('');
  $('speedSeg').querySelectorAll('button').forEach((b) => (b.onclick = () => { S.speed = SPEEDS.find((s) => s.id === b.dataset.id); renderTabs(); }));
}
function reset() {
  S.t = START_T; stop();
  delete S.policy[S.scn]; delete S.revealed[S.scn];
  S.pausedAt = new Set([...S.pausedAt].filter((k) => !k.startsWith(S.scn + ':')));
  if (S.scn === 'sandbox') { S.sandbox = []; renderSandbox(); }
  compute();
}

function renderDrawer() {
  const c = S.cost;
  const inp = (k) => `<input type="number" min="0" step="1" data-k="${k}" value="${c[k]}">`;
  $('drawerBody').innerHTML = `
  <p>Everything here is simulated: synthetic sensor data, a fictional supplier and a fictional part. The detector is real code running on that data. Nothing on this page is a measured Nabz result.</p>
  <h4>How Nabz decides</h4>
  <ul>
    <li><b>Counting welds.</b> Current above ${DETECTOR.ampsOn} A starts an arc, and below ${DETECTOR.ampsOff} A ends it. Anything shorter than ${DETECTOR.minDwell} s is ignored. At each part change the arcs are matched to the recipe: 4 welds, each at least 80% of its normal length. A miss holds that part.</li>
    <li><b>Scoring sound.</b> Sound is measured only while an arc is on. Each arc becomes ${DETECTOR.bands} frequency-band energies, compared with ${DETECTOR.baselineParts} known-good parts from before the last passed teardown. The part score is the middle of its four arcs.</li>
    <li><b>Alert threshold.</b> The threshold is ${BASELINE.threshold.toFixed(2)}: the 99th percentile of ${DETECTOR.validationParts} separate good parts, plus 10%.</li>
    <li><b>When to speak up.</b> With ${DETECTOR.watchK} of the last ${DETECTOR.window} parts above the threshold, Nabz is <i>watching</i>. With ${DETECTOR.adviseK} of ${DETECTOR.window}, it asks for a setup check. No signal means <i>unverified</i>, never a guess.</li>
    <li><b>No hindsight.</b> Each decision uses only parts already made. The tests check this.</li>
  </ul>
  <h4>What is real today</h4>
  <table>
    <tr><td>Missed or short weld check</td><td><span class="st">concept, staged</span></td></tr>
    <tr><td>Sound drift advisory</td><td><span class="st">illustrative</span></td></tr>
    <tr><td>Lead time and false alerts</td><td><span class="st">not measured yet</span></td></tr>
    <tr><td>Station log and traceability</td><td><span class="st">proposed</span></td></tr>
  </table>
  <h4>Cost inputs (edit to recalculate)</h4>
  <table>
    <tr><td>Scrap value per bracket</td><td>₹ ${inp('scrapPerPart')}</td></tr>
    <tr><td>Handling and sorting per quarantined part</td><td>₹ ${inp('sortPerHeldPart')}</td></tr>
    <tr><td>Margin lost per part not made</td><td>₹ ${inp('marginPerPart')}</td></tr>
    <tr><td>Containment stop after a failed teardown</td><td>${inp('containmentMinutes')} min</td></tr>
    <tr><td>Cost per bad part reaching the customer</td><td>₹ ${inp('escapePerPart')}</td></tr>
    <tr><td>Operator setup check</td><td>${DETECTOR.checkMinutes} min</td></tr>
  </table>
  <p class="small">Sorting is about 10 minutes of an inspector at roughly ₹150 an hour with overhead. The Haryana skilled minimum wage was about ₹13,000–13,700 a month in 2025. The other values are placeholders for a pilot to replace.</p>
  <h4>The job</h4>
  <table>
    <tr><td>Part</td><td>${JOB.partNo} ${JOB.partName.toLowerCase()}</td></tr>
    <tr><td>Process</td><td style="white-space:normal">${JOB.process}</td></tr>
    <tr><td>Cycle · interval between teardowns</td><td>${CYC} s · ${N} parts</td></tr>
    ${JOB.welds.map((w) => `<tr><td>${w.id} ${w.name}</td><td>${w.dur.toFixed(1)} s at ${w.amps} A</td></tr>`).join('')}
  </table>
  <h4>The scenarios</h4>
  <ul>
    <li><b>Worn contact tip.</b> ${PRESETS.fault.truth}</li>
    <li><b>Healthy.</b> ${PRESETS.healthy.truth}</li>
    <li><b>Wire lot change.</b> ${PRESETS.borderline.truth}</li>
    <li><b>Sandbox.</b> Faults start on the next part. A worn tip ramps up and can burn back. A skipped weld and a dropped clamp signal affect one part.</li>
  </ul>
  <h4>Sources</h4>
  <ul>
    <li>Project brief: <code>docs.md</code> in this repository.</li>
    <li>Stemmer et al., <a href="https://arxiv.org/abs/2409.02290" target="_blank" rel="noopener">Unsupervised welding defect detection using audio and video</a>, Intel, 2024. Their accuracy figures are Intel's, on robotic welds, not Nabz's.</li>
    <li>Rohe et al., <a href="https://doaj.org/article/dbd1a86babec4432a10e4faeb1f54dde" target="_blank" rel="noopener">shielding-gas flow detection from weld audio</a>, 2021.</li>
    <li><a href="https://studio.edgeimpulse.com/public/47648/latest/acquisition/training" target="_blank" rel="noopener">Belgian Welding Institute weld sound clips</a>, the planned first audio baseline.</li>
    <li>Tregaskiss, <a href="https://bernardtregaskiss.com/understanding-and-extending-contact-tip-life" target="_blank" rel="noopener">Understanding and extending contact tip life</a>.</li>
    <li>Miller, <a href="https://www.millerwelds.com/resources/article-library/mig-welding-101" target="_blank" rel="noopener">MIG welding 101</a>.</li>
    <li>Assembly Magazine, <a href="https://www.assemblymag.com/articles/95740-parts-quarantine-and-recovery" target="_blank" rel="noopener">Parts quarantine and recovery</a>.</li>
    <li><a href="https://www.siam.in/siam-voluntary-recall" target="_blank" rel="noopener">SIAM recall register</a>, Volkswagen and Škoda, October 2024.</li>
    <li><a href="https://wageindicator.org/en-in/work-in-india/minimum-wage/17192-haryana/17487-shops-and-commercial-establishments" target="_blank" rel="noopener">WageIndicator, Haryana minimum wage</a>.</li>
  </ul>`;
  $('drawerBody').querySelectorAll('input').forEach((i) => (i.oninput = () => {
    S.cost[i.dataset.k] = Math.max(0, Number(i.value) || 0);
    OUT = outcomes(scenario(), policy() || 'act', S.cost);
    keys.out = null;
  }));
}
function drawer(open) {
  $('drawer').classList.toggle('open', open);
  $('drawer').setAttribute('aria-hidden', String(!open));
  $('scrim').hidden = !open;
}

function boot() {
  station = createStation($('vp'), $('vpOverlay'));
  bindFullscreen($('simulation'), $('fullscreenBtn'), $('fullscreenStatus'));
  compute();
  renderTabs(); renderSandbox(); renderDrawer();
  $('introText').textContent = PRESETS[S.scn].intro;
  bindScrub($('scoreCv')); bindScrub($('tlCv'));
  $('playBtn').onclick = () => {
    if (waitingForDecision()) $('decision').querySelector('button')?.focus();
    else if (S.playing) stop();
    else play();
  };
  $('nextBtn').onclick = seekNext;
  $('resetBtn').onclick = reset;
  $('methodBtn').onclick = () => drawer(true);
  $('drawerClose').onclick = () => drawer(false);
  $('scrim').onclick = () => drawer(false);
  $('viewSeg').querySelectorAll('button').forEach((b) => (b.onclick = () => {
    station.setView(b.dataset.v);
    $('viewSeg').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('labelsBtn').onclick = () => { S.labels = !S.labels; station.setLabels(S.labels); $('labelsBtn').setAttribute('aria-pressed', String(S.labels)); };
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || (e.key === ' ' && e.target.closest('button'))) return;
    if (e.key === ' ') { e.preventDefault(); S.playing ? stop() : play(); }
    else if (e.key === 'ArrowRight') { stop(); setT(Math.floor(S.t + 1e-9) + 1); }
    else if (e.key === 'ArrowLeft') { stop(); setT(Math.ceil(S.t - 1e-9) - 1); }
    else if (e.key === 'n' || e.key === 'N') seekNext();
    else if (e.key === 'Escape') drawer(false);
  });
  window.__nabz = { S, view, choose, setT, setScenario, reset, outcomes: () => OUT, runs: () => RUNS, seekNext };
  requestAnimationFrame(frame);
}
boot();
