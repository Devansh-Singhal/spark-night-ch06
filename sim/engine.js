// Nabz simulation engine.
// Pure and deterministic: the same scenario + operator decision always yields
// the same run. No DOM access, so it runs in the browser and in Node tests.
//
// Mechanism follows docs.md:
//   1. Segment arcs from the clamp current (separate on/off thresholds + minimum dwell).
//   2. At the part boundary, compare arc count and durations with the job recipe -> HOLD.
//   3. Score sound during each arc against a frozen, job-specific baseline
//      (robust distance from the median feature vector).
//   4. A sustained run of elevated part scores -> amber CHECK SETUP advisory.
//      A single noisy arc does not stop the line.
// Every detector decision for part p uses only data from parts <= p.

// ---------------------------------------------------------------- job & recipe
export const JOB = {
  station: 'Station 02',
  plant: 'Kundli plant (fictional supplier)',
  partNo: 'RSB-417',
  partName: 'Rear suspension bracket',
  process: 'MIG (GMAW), short-circuit transfer, 0.9 mm ER70S-6, Ar/CO₂ 82/18',
  cycleSec: 48,             // load, clamp, weld, unclamp
  firstPart: 101,           // run starts right after a passed teardown on part 0100
  lastPart: 220,            // next sampled cut-and-etch teardown
  lastGoodCheck: 100,
  shiftStart: '14:02:00',
  welds: [
    // start time within the cycle (s), nominal arc duration (s), nominal current (A)
    { id: 'W1', name: 'Gusset left',  start: 9.0,  dur: 3.2, amps: 165 },
    { id: 'W2', name: 'Gusset right', start: 15.0, dur: 3.2, amps: 165 },
    { id: 'W3', name: 'Tube saddle',  start: 22.0, dur: 4.4, amps: 180 },
    { id: 'W4', name: 'Tab fillet',   start: 30.5, dur: 2.4, amps: 150 },
  ],
  durTolerance: 0.2,        // recipe: arc must be >= 80% of nominal duration
};

export const DETECTOR = {
  ampsOn: 40,               // arc-on threshold (A)
  ampsOff: 20,              // arc-off threshold (A)
  minDwell: 0.3,            // s; shorter pulses are ignored (failed starts, spikes)
  sampleHz: 50,             // display/segmentation rate for the simulated clamp stream
  bands: 8,                 // compact log-mel style band energies per arc
  baselineParts: 40,        // known-good parts 0061-0100 (passed teardown at 0100)
  validationParts: 40,      // separate known-good parts for the threshold
  thresholdQuantile: 0.99,
  window: 6,                // rolling window of parts
  watchK: 2,                // >= 2 of last 6 elevated -> WATCH (no action)
  adviseK: 4,               // >= 4 of last 6 elevated -> amber CHECK SETUP
  checkMinutes: 3,          // operator setup check / tip change
};

export const BAND_LABELS = ['0.1', '0.3', '0.6', '1.2', '2.4', '4.8', '9.6', '16'];

// ---------------------------------------------------------------- scenarios
export const SCENARIOS = {
  healthy: {
    id: 'healthy',
    seed: 0,
    label: 'Healthy run',
    short: 'Healthy',
    story: 'A normal shift segment. A grinder near the station spikes one arc, and the clamp drops out for one part.',
    truth: 'No process change. Every weld is sound.',
    drift: () => 0,
    grinderArcs: [[127, 2]],   // [part, weldIndex] — loud nearby noise on a single arc
    dropouts: [196],           // clamp stream lost for this part
    missedArcs: [],
    defectAt: Infinity,
    cause: null,
  },
  fault: {
    id: 'fault',
    seed: 0,
    label: 'Fault run · worn contact tip',
    short: 'Worn tip',
    story: 'The contact-tip bore wears. The arc gets less stable long before the bead looks wrong.',
    truth: 'Tip wear starts at part 0136. Lack of fusion inside welds from the severity limit on. Burnback stops the wire on W3 of part 0184.',
    // severity 0..1: slow ramp after onset
    drift: (p) => (p < 136 ? 0 : Math.min(1, Math.pow((p - 136) / 64, 1.25))),
    grinderArcs: [[118, 0]],
    dropouts: [],
    missedArcs: [[184, 2]],    // docs.md: part 0184, three of four expected welds
    defectAt: 0.55,            // severity above which welds have internal defects
    cause: 'Worn contact tip',
    fixLabel: 'Change contact tip',
  },
  borderline: {
    id: 'borderline',
    seed: 31,
    label: 'Borderline · new wire lot',
    short: 'Wire lot',
    story: 'A new wire spool from a different lot is loaded at part 0150 without refreshing the baseline. Welds stay in spec.',
    truth: 'Small, harmless shift in arc sound from part 0150. No defects.',
    drift: (p) => (p < 150 ? 0 : 0.28),
    grinderArcs: [],
    dropouts: [],
    missedArcs: [],
    defectAt: Infinity,
    cause: 'Wire lot change (in spec)',
    fixLabel: 'Check setup',
    benign: true,
  },
};

// ---------------------------------------------------------------- deterministic RNG
// Counter-based: noise for (part, weld, k) is identical in every branch of the run,
// so the "with Nabz" branch diverges from the baseline only where the operator acts.
function hash32(a, b, c, d) {
  let h = 0x9e3779b9 ^ a;
  h = Math.imul(h ^ (b + 0x85ebca6b), 0xc2b2ae35);
  h = Math.imul(h ^ (c + 0x27d4eb2f), 0x165667b1);
  h = Math.imul(h ^ (d + 0x7f4a7c15), 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
const u01 = (a, b, c, d) => (hash32(a, b, c, d) + 0.5) / 4294967296;
function gauss(a, b, c, d) {
  const u = u01(a, b, c, d * 2), v = u01(a, b, c, d * 2 + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const SEED = 4170;

// ---------------------------------------------------------------- acoustic model
// Per weld position: a nominal band-energy profile (dB). Tip wear adds broadband
// crackle (spatter, irregular short circuits) and shifts energy upward;
// a wire-lot change shifts it mildly.
const PROFILE = [
  [62, 66, 70, 68, 63, 57, 50, 42],
  [62, 66, 70, 68, 63, 57, 50, 42],
  [64, 68, 72, 70, 64, 57, 49, 41],
  [60, 64, 68, 67, 62, 56, 50, 43],
];
const SIGMA = [1.6, 1.4, 1.2, 1.2, 1.3, 1.5, 1.8, 2.0];
const WEAR_SHIFT = [-1.0, -1.5, -2.5, -1.0, 2.5, 4.5, 6.0, 6.5];
const LOT_SHIFT = [0.5, 1.0, 1.5, 1.0, 1.5, 2.5, 3.0, 3.0];
const GRINDER = [0, 1, 2, 4, 9, 14, 16, 12];

function arcFeatures(scn, p, w, severity) {
  const shift = scn.id === 'borderline' ? LOT_SHIFT : WEAR_SHIFT;
  const out = new Array(8);
  for (let b = 0; b < 8; b++) {
    const jitter = 1 + 0.9 * severity;          // a less stable arc is also more variable
    out[b] = PROFILE[w][b] + severity * shift[b] + SIGMA[b] * jitter * gauss(SEED + (scn.seed || 0), p, w, b);
  }
  if (scn.grinderArcs.some(([gp, gw]) => gp === p && gw === w)) {
    for (let b = 0; b < 8; b++) out[b] += GRINDER[b];
  }
  return out;
}

// ---------------------------------------------------------------- baseline
const median = (a) => {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

// Baseline: welds from the 40 known-good parts before the passed teardown at 0100.
// Separate known-good validation parts set the threshold. Then frozen.
function fitBaseline() {
  const base = JOB.welds.map((_, w) => {
    const rows = [];
    for (let i = 0; i < DETECTOR.baselineParts; i++) {
      rows.push(arcFeatures(SCENARIOS.healthy, -1000 - i, w, 0));
    }
    const med = [], mad = [];
    for (let b = 0; b < 8; b++) {
      const col = rows.map((r) => r[b]);
      const m = median(col);
      med.push(m);
      mad.push(1.4826 * median(col.map((v) => Math.abs(v - m))));
    }
    return { med, mad };
  });
  const val = [];
  for (let i = 0; i < DETECTOR.validationParts; i++) {
    const arcs = JOB.welds.map((_, w) => scoreArc(base, w, arcFeatures(SCENARIOS.healthy, -3000 - i, w, 0)));
    val.push(partScore(arcs));
  }
  const threshold = Math.round(quantile(val, DETECTOR.thresholdQuantile) * 1.1 * 100) / 100;
  return { positions: base, threshold, version: 'RSB-417 · b3 · fitted on 0061–0100', valScores: val };
}

function scoreArc(base, w, x) {
  const { med, mad } = base[w];
  let s = 0;
  const z = x.map((v, b) => {
    const zz = (v - med[b]) / mad[b];
    s += zz * zz;
    return zz;
  });
  return { score: Math.sqrt(s / x.length), z };
}
// Part score = median of its arc scores, so one noisy arc can't elevate a part.
function partScore(arcs) {
  return median(arcs.map((a) => a.score));
}

export const BASELINE = fitBaseline();

// ---------------------------------------------------------------- clamp current
// Synthetic current samples for one part cycle. Short-circuit transfer shows as
// ripple; a worn tip makes the ripple irregular. Burnback produces a failed start
// shorter than the minimum dwell.
export function currentTrace(scn, p, severity, dropped, allowMissed = true) {
  const hz = DETECTOR.sampleHz;
  const n = Math.round(JOB.cycleSec * hz);
  const a = new Float32Array(n);
  if (dropped) return null;
  const missed = new Set(allowMissed ? scn.missedArcs.filter(([mp]) => mp === p).map(([, w]) => w) : []);
  JOB.welds.forEach((wd, w) => {
    const startJ = 0.15 * gauss(SEED + 7, p, w, 0);
    const t0 = wd.start + startJ;
    if (missed.has(w)) {
      // failed start: two short blips under the dwell time
      for (const [off, len] of [[0, 0.12], [0.5, 0.08]]) {
        const i0 = Math.round((t0 + off) * hz);
        for (let i = i0; i < i0 + Math.round(len * hz); i++) a[i] = 90 + 40 * u01(SEED + 9, p, w, i);
      }
      return;
    }
    const dur = wd.dur * (1 + 0.025 * gauss(SEED + 11, p, w, 0)) * (1 - 0.06 * severity);
    const i0 = Math.round(t0 * hz), i1 = Math.round((t0 + dur) * hz);
    for (let i = i0; i < i1; i++) {
      const ripple = (0.07 + 0.11 * severity) * wd.amps * gauss(SEED + 13, p, w, i);
      const ramp = Math.min(1, (i - i0 + 1) / 4);
      a[i] = Math.max(0, ramp * wd.amps + ripple);
    }
  });
  // idle noise floor
  for (let i = 0; i < n; i++) if (a[i] === 0) a[i] = Math.abs(1.5 * gauss(SEED + 17, p, 0, i));
  return a;
}

// Hysteresis segmentation with minimum dwell (docs.md technical approach step 1).
export function segmentArcs(trace) {
  const hz = DETECTOR.sampleHz;
  const arcs = [];
  let on = false, s = 0;
  for (let i = 0; i < trace.length; i++) {
    if (!on && trace[i] >= DETECTOR.ampsOn) { on = true; s = i; }
    else if (on && trace[i] < DETECTOR.ampsOff) {
      on = false;
      const dur = (i - s) / hz;
      if (dur >= DETECTOR.minDwell) {
        let sum = 0;
        for (let k = s; k < i; k++) sum += trace[k];
        arcs.push({ start: s / hz, end: i / hz, dur, amps: sum / (i - s) });
      }
    }
  }
  return arcs;
}

// Match detected arcs to recipe slots by start time.
function matchRecipe(arcs) {
  return JOB.welds.map((wd) => arcs.find((a) => Math.abs(a.start - wd.start) < 2.5) || null);
}

// ---------------------------------------------------------------- run
// decision: 'act' (operator does the setup check at the advisory) | 'ignore'
export function runScenario(scenarioId, decision = 'act') {
  const scn = SCENARIOS[scenarioId];
  const parts = [];
  const elevated = [];       // rolling flags for parts with scores
  let advisory = null;       // first advisory event
  let intervention = null;   // part index after which the setup was fixed/checked
  let adviseOpen = false;
  const events = [];
  let resetAt = null;        // part after which drift is cleared (tip changed)

  for (let p = JOB.firstPart; p <= JOB.lastPart; p++) {
    // truth for the baseline branch (no intervention)
    const sevBase = scn.drift(p);
    // truth for the Nabz branch: a tip change resets wear; a wire-lot "check" changes nothing
    const fixed = resetAt !== null && p > resetAt && !scn.benign;
    const severity = fixed ? 0 : sevBase;

    const dropped = scn.dropouts.includes(p);
    // burnback only happens on the worn tip; after a tip change the weld strikes normally
    const missedHere = !fixed && scn.missedArcs.some(([mp]) => mp === p);
    const trace = currentTrace(scn, p, severity, dropped, !fixed);
    let slots = null;
    if (trace) slots = matchRecipe(segmentArcs(trace));

    // acoustic scores — only during detected arc windows (audio is gated by current)
    let arcScores = null, pScore = null;
    if (slots) {
      arcScores = slots.map((s, w) => {
        if (!s) return null;
        const x = arcFeatures(scn, p, w, severity);
        return { ...scoreArc(BASELINE.positions, w, x), x };
      });
      const valid = arcScores.filter(Boolean);
      pScore = valid.length ? partScore(valid) : null;
    }

    // rule 1: count + duration at the part boundary
    let rule = 'ok', reason = '';
    if (!slots) {
      rule = 'unverified';
      reason = 'Clamp signal lost — part not verified';
    } else {
      const missing = slots.map((s, w) => (s ? null : JOB.welds[w].id)).filter(Boolean);
      const short = slots
        .map((s, w) => (s && s.dur < JOB.welds[w].dur * (1 - JOB.durTolerance) ? JOB.welds[w].id : null))
        .filter(Boolean);
      if (missing.length) { rule = 'hold'; reason = `${4 - missing.length} of 4 welds · ${missing.join(', ')} missing`; }
      else if (short.length) { rule = 'hold'; reason = `Short arc on ${short.join(', ')}`; }
    }

    // rule 2: sustained audio drift (k of last n)
    const isElev = pScore !== null && pScore > BASELINE.threshold;
    if (pScore !== null) elevated.push(isElev);
    const win = elevated.slice(-DETECTOR.window);
    const k = win.filter(Boolean).length;
    let drift = 'ok';
    if (adviseOpen) drift = 'advise';
    else if (k >= DETECTOR.adviseK) {
      drift = 'advise';
      adviseOpen = true;
      if (!advisory) {
        advisory = { part: p, k, n: win.length, score: pScore };
        events.push({ type: 'advisory', part: p });
      } else {
        events.push({ type: 'advisory-repeat', part: p });
      }
      if (decision === 'act' && resetAt === null) {
        resetAt = p;
        intervention = { part: p, minutes: DETECTOR.checkMinutes, label: scn.fixLabel || 'Check setup' };
        events.push({ type: 'intervention', part: p });
      }
    } else if (k >= DETECTOR.watchK) drift = 'watch';

    // after the operator checks, the advisory is acknowledged and the window cleared
    if (resetAt === p && decision === 'act') {
      adviseOpen = false;
      elevated.length = 0;
    }

    if (rule === 'hold') events.push({ type: 'hold', part: p });
    if (rule === 'unverified') events.push({ type: 'unverified', part: p });

    // ground truth (what a section would show)
    const internalDefect = severity > scn.defectAt + 0.03 * gauss(SEED + 23, p, 0, 0);
    parts.push({
      part: p,
      severity, severityBase: sevBase,
      trace: trace ? true : false,
      arcs: slots,
      arcScores,
      score: pScore,
      elevated: isElev,
      k, n: win.length,
      rule, reason,
      drift,
      truth: missedHere ? 'missing' : internalDefect ? 'defect' : 'good',
    });
  }

  return { scenario: scn, decision, parts, advisory, intervention, events, baseline: BASELINE };
}

// Baseline workflow (no Nabz) for the same physical run: nothing is known
// until the sampled cut-and-etch teardown at the end of the interval.
export function baselineTruth(scenarioId) {
  const scn = SCENARIOS[scenarioId];
  const out = [];
  for (let p = JOB.firstPart; p <= JOB.lastPart; p++) {
    const severity = scn.drift(p);
    const missed = scn.missedArcs.some(([mp]) => mp === p);
    const defect = severity > scn.defectAt + 0.03 * gauss(SEED + 23, p, 0, 0);
    out.push({ part: p, severity, truth: missed ? 'missing' : defect ? 'defect' : 'good' });
  }
  return out;
}

// ---------------------------------------------------------------- outcomes & cost
export const COST_DEFAULTS = {
  scrapPerPart: 450,        // ₹ material + processing value of one bracket
  sortPerHeldPart: 25,      // ₹ handling + visual sort per quarantined part
  marginPerPart: 40,        // ₹ contribution lost per part not produced
  containmentMinutes: 30,   // station stop for containment + root cause after a failed teardown
};

export function outcomes(scenarioId, decision, cost = COST_DEFAULTS) {
  const run = runScenario(scenarioId, decision);
  const base = baselineTruth(scenarioId);
  const perMin = (60 / JOB.cycleSec) * cost.marginPerPart;
  const minuteOf = (p) => ((p - JOB.firstPart + 1) * JOB.cycleSec) / 60;

  // --- baseline: sampled teardown on the last part of the interval
  const sample = base[base.length - 1];
  const bad = base.filter((b) => b.truth !== 'good');
  const firstBad = bad.length ? bad[0].part : null;
  const teardownFails = sample.truth !== 'good';
  const B = {
    surfaces: teardownFails ? JOB.lastPart : null,
    surfacesMin: teardownFails ? minuteOf(JOB.lastPart) : null,
    held: teardownFails ? JOB.lastPart - JOB.lastGoodCheck : 0,
    // additional cut-and-etch samples bound the range; the bounded range is scrapped
    scrapped: teardownFails ? JOB.lastPart - firstBad + 1 : 0,
    stopMin: teardownFails ? cost.containmentMinutes : 0,
    escaped: teardownFails ? 0 : bad.length,
  };
  // --- with Nabz (same physical run; branch diverges at the intervention)
  const nb = run.parts.filter((p) => p.truth !== 'good');
  const nFirstBad = nb.length ? nb[0].part : null;
  const nSample = run.parts[run.parts.length - 1];
  const nFails = nSample.truth !== 'good';
  const heldAtStation = run.parts.filter((p) => p.rule === 'hold').length;
  const unverified = run.parts.filter((p) => p.rule === 'unverified').length;
  const N = {
    surfaces: run.advisory ? run.advisory.part : run.events.find((e) => e.type === 'hold')?.part ?? null,
    surfacesMin: null,
    held: nFails ? JOB.lastPart - JOB.lastGoodCheck : 0,
    heldAtStation,
    unverified,
    scrapped: nFails ? JOB.lastPart - nFirstBad + 1 : heldAtStation,
    stopMin: (run.intervention ? run.intervention.minutes : 0) + (nFails ? cost.containmentMinutes : 0),
    escaped: 0,
  };
  if (N.surfaces) N.surfacesMin = minuteOf(N.surfaces);

  const price = (o) => ({
    hold: o.held * cost.sortPerHeldPart + (o.unverified || 0) * cost.sortPerHeldPart,
    scrap: o.scrapped * cost.scrapPerPart,
    stop: Math.round(o.stopMin * perMin),
  });
  const bc = price(B), nc = price(N);
  bc.total = bc.hold + bc.scrap + bc.stop;
  nc.total = nc.hold + nc.scrap + nc.stop;

  return {
    run, base, B, N, bc, nc, perMin, firstBad, nFirstBad,
    avoided: bc.total - nc.total,
    warningParts: N.surfaces && B.surfaces ? B.surfaces - N.surfaces : null,
    warningMin: N.surfaces && B.surfaces ? minuteOf(B.surfaces) - minuteOf(N.surfaces) : null,
    leadParts: run.advisory && firstBad ? firstBad - run.advisory.part : null,
    minuteOf,
  };
}

export function clockAt(p, extraMin = 0) {
  const [h, m, s] = JOB.shiftStart.split(':').map(Number);
  const t = Math.floor(h * 3600 + m * 60 + s + (p - JOB.firstPart) * JOB.cycleSec + extraMin * 60);
  const hh = Math.floor(t / 3600) % 24, mm = Math.floor(t / 60) % 60, ss = t % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
export const pid = (p) => String(p).padStart(4, '0');
