// Nabz simulation engine.
// Pure and deterministic: the same scenario (fault list) + operator policy always
// yields the same run. No DOM access, so it runs in the browser and in Node tests.
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
    { id: 'W1', name: 'Left gusset',  start: 9.0,  dur: 3.2, amps: 165 },
    { id: 'W2', name: 'Right gusset', start: 15.0, dur: 3.2, amps: 165 },
    { id: 'W3', name: 'Tube collar',  start: 22.0, dur: 4.4, amps: 180 },
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

// ---------------------------------------------------------------- faults & presets
// A scenario is a seed plus a list of faults. Each fault starts at a part.
//   wear    contact tip wears from `at` (arc gets less stable; later lack of fusion; burnback)
//   lot     new wire lot from `at` (small, harmless change in arc sound)
//   noise   loud shop noise (grinder) on one arc of part `at`
//   dropout clamp signal lost for part `at`
//   skip    weld `weld` of part `at` is never made
export const FAULT_INFO = {
  wear: { label: 'Worn contact tip', short: 'Tip wear' },
  lot: { label: 'New wire lot', short: 'Wire lot' },
  noise: { label: 'Grinder next to the station', short: 'Grinder' },
  dropout: { label: 'Clamp signal lost', short: 'Clamp lost' },
  skip: { label: 'Weld skipped', short: 'Skipped weld' },
};

export const PRESETS = {
  healthy: {
    id: 'healthy',
    label: 'Healthy run',
    seed: 0,
    faults: [{ kind: 'noise', at: 127, weld: 2 }, { kind: 'dropout', at: 196 }],
    intro: 'A normal stretch of production. Nothing is wrong with the process, but the shop is not quiet.',
    truth: 'No process change. A grinder spikes one arc on part 0127, and the clamp signal drops on part 0196. Every weld is sound.',
  },
  fault: {
    id: 'fault',
    label: 'Worn contact tip',
    seed: 0,
    faults: [{ kind: 'wear', at: 136 }, { kind: 'noise', at: 118, weld: 0 }],
    intro: 'The contact tip that feeds wire into the arc slowly wears out. Watch the arc sound.',
    truth: 'Tip wear starts at part 0136. Lack of fusion inside the welds from part 0175. The wire burns back and W3 is never made on part 0184.',
  },
  borderline: {
    id: 'borderline',
    label: 'Wire lot change',
    seed: 31,
    faults: [{ kind: 'lot', at: 150 }],
    intro: 'A new wire spool is loaded mid-run. It is within spec, but it sounds a little different.',
    truth: 'New wire lot from part 0150 without a baseline refresh. Welds stay in spec. No defects.',
  },
  sandbox: {
    id: 'sandbox',
    label: 'Sandbox',
    seed: 7,
    faults: [],
    intro: 'Run the station and break it yourself. Each fault starts on the next part.',
    truth: 'Whatever you injected.',
  },
};

const wearRamp = (d) => (d <= 0 ? 0 : Math.min(1, Math.pow(d / 64, 1.25)));
const WEAR_DEFECT = 0.55;   // severity above which welds have internal lack of fusion
const WEAR_BURNBACK = 0.68; // severity at which the wire burns back once (missed W3)
const LOT_SHIFT_SIZE = 0.28;

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

function arcFeatures(seed, p, w, wearSev, lotSev, noisy) {
  const out = new Array(8);
  const jitter = 1 + 0.9 * (wearSev + lotSev);   // a less stable arc is also more variable
  for (let b = 0; b < 8; b++) {
    out[b] = PROFILE[w][b] + wearSev * WEAR_SHIFT[b] + lotSev * LOT_SHIFT[b] + SIGMA[b] * jitter * gauss(SEED + seed, p, w, b);
    if (noisy) out[b] += GRINDER[b];
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
    for (let i = 0; i < DETECTOR.baselineParts; i++) rows.push(arcFeatures(0, -1000 - i, w, 0, 0, false));
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
    const arcs = JOB.welds.map((_, w) => scoreArc(base, w, arcFeatures(0, -3000 - i, w, 0, 0, false)));
    val.push(partScore(arcs));
  }
  const threshold = Math.round(quantile(val, DETECTOR.thresholdQuantile) * 1.1 * 100) / 100;
  return { positions: base, threshold, version: 'RSB-417 · v3 · parts 0061–0100', valScores: val };
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
const partScore = (arcs) => median(arcs.map((a) => a.score));

export const BASELINE = fitBaseline();

// ---------------------------------------------------------------- clamp current
// Synthetic current samples for one part cycle. Short-circuit transfer shows as
// ripple; a worn tip makes the ripple irregular. A missed weld shows only failed
// starts shorter than the minimum dwell.
export function currentTrace(p, severity, missed) {
  const hz = DETECTOR.sampleHz;
  const n = Math.round(JOB.cycleSec * hz);
  const a = new Float32Array(n);
  JOB.welds.forEach((wd, w) => {
    const t0 = wd.start + 0.15 * gauss(SEED + 7, p, w, 0);
    if (missed.includes(w)) {
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
const matchRecipe = (arcs) => JOB.welds.map((wd) => arcs.find((a) => Math.abs(a.start - wd.start) < 2.5) || null);

// ---------------------------------------------------------------- run
// policy: 'act'    operator does the setup check at every advisory
//         'ignore' operator keeps running (also: the physics of the no-Nabz baseline)
export function runScenario(scn, policy = 'act') {
  const parts = [];
  const elevated = [];
  const advisories = [], interventions = [], events = [];
  let adviseOpen = false;
  let wearStart = null, burnbackDone = false;

  for (let p = JOB.firstPart; p <= JOB.lastPart; p++) {
    const here = scn.faults.filter((f) => f.at === p);
    if (here.some((f) => f.kind === 'wear') && wearStart === null) { wearStart = p; burnbackDone = false; }
    const wearSev = wearStart === null ? 0 : wearRamp(p - wearStart);
    const lotSev = scn.faults.some((f) => f.kind === 'lot' && f.at <= p) ? LOT_SHIFT_SIZE : 0;
    const sev = wearSev + lotSev;

    const missed = here.filter((f) => f.kind === 'skip').map((f) => f.weld);
    let burnback = false;
    if (wearSev >= WEAR_BURNBACK && !burnbackDone) { burnback = true; burnbackDone = true; if (!missed.includes(2)) missed.push(2); }
    const dropped = here.some((f) => f.kind === 'dropout');
    const noisyWelds = here.filter((f) => f.kind === 'noise').map((f) => f.weld);

    let slots = null;
    if (!dropped) slots = matchRecipe(segmentArcs(currentTrace(p, sev, missed)));

    // acoustic scores — only during detected arc windows (audio is gated by current)
    let arcScores = null, pScore = null;
    if (slots) {
      arcScores = slots.map((s, w) => {
        if (!s) return null;
        const x = arcFeatures(scn.seed, p, w, wearSev, lotSev, noisyWelds.includes(w));
        return { ...scoreArc(BASELINE.positions, w, x), x };
      });
      const valid = arcScores.filter(Boolean);
      pScore = valid.length ? partScore(valid) : null;
    }

    // rule 1: count + duration at the part boundary
    let rule = 'ok', reason = '';
    if (!slots) { rule = 'unverified'; reason = 'Clamp signal lost, so the arcs could not be counted'; }
    else {
      const miss = slots.map((s, w) => (s ? null : JOB.welds[w].id)).filter(Boolean);
      const short = slots.map((s, w) => (s && s.dur < JOB.welds[w].dur * (1 - JOB.durTolerance) ? JOB.welds[w].id : null)).filter(Boolean);
      if (miss.length) { rule = 'hold'; reason = `${4 - miss.length} of 4 welds · ${miss.join(', ')} missing`; }
      else if (short.length) { rule = 'hold'; reason = `Short arc on ${short.join(', ')}`; }
    }

    // rule 2: sustained audio drift (k of last n)
    const isElev = pScore !== null && pScore > BASELINE.threshold;
    if (pScore !== null) elevated.push(isElev);
    const win = elevated.slice(-DETECTOR.window);
    const k = win.filter(Boolean).length;
    let drift = 'ok', checked = null;
    if (adviseOpen) drift = 'advise';
    else if (k >= DETECTOR.adviseK) {
      drift = 'advise';
      adviseOpen = true;
      advisories.push({ part: p, k, n: win.length, score: pScore });
      events.push({ type: 'advisory', part: p });
      if (policy === 'act') {
        // the check happens at this part boundary; a worn tip is found and replaced
        checked = { part: p, minutes: DETECTOR.checkMinutes, found: wearStart !== null ? 'wear' : null };
        interventions.push(checked);
        events.push({ type: 'check', part: p });
        if (wearStart !== null) wearStart = null;
        adviseOpen = false;
        elevated.length = 0;
      }
    } else if (k >= DETECTOR.watchK) drift = 'watch';

    if (rule === 'hold') events.push({ type: 'hold', part: p });
    if (rule === 'unverified') events.push({ type: 'unverified', part: p });

    const internalDefect = wearSev > WEAR_DEFECT + 0.03 * gauss(SEED + 23, p, 0, 0);
    parts.push({
      part: p, wearSev, lotSev, severity: sev, missed, burnback, dropped,
      arcs: slots, arcScores, score: pScore, elevated: isElev,
      k, n: win.length, rule, reason, drift, checked,
      truth: missed.length ? 'missing' : internalDefect ? 'defect' : 'good',
    });
  }

  return {
    scenario: scn, policy, parts, events, advisories, interventions,
    advisory: advisories[0] || null, intervention: interventions[0] || null, baseline: BASELINE,
  };
}

// ---------------------------------------------------------------- outcomes & cost
export const COST_DEFAULTS = {
  scrapPerPart: 450,        // ₹ material + processing value of one bracket
  sortPerHeldPart: 25,      // ₹ handling + visual sort per quarantined part
  marginPerPart: 40,        // ₹ contribution lost per part not produced
  containmentMinutes: 30,   // station stop for containment + root cause after a failed teardown
  escapePerPart: 5000,      // ₹ per defective part that reaches the customer (complaint, sort at customer)
};

const minuteOf = (p) => ((p - JOB.firstPart + 1) * JOB.cycleSec) / 60;

// What a workflow costs, given the physical truth of its parts and what was caught at the station.
function settle(parts, cost, withNabz) {
  const bad = parts.filter((p) => p.truth !== 'good');
  const sampleBad = parts[parts.length - 1].truth !== 'good';
  const heldAtStation = withNabz ? parts.filter((p) => p.rule === 'hold') : [];
  const unverified = withNabz ? parts.filter((p) => p.rule === 'unverified').length : 0;
  const firstBad = bad.length ? bad[0].part : null;
  const o = { teardownFails: sampleBad, firstBad, heldAtStation: heldAtStation.length, unverified };
  if (sampleBad) {
    // cut-and-etch fails: quarantine everything since the last good check; extra sections
    // bound the range and the bounded range is scrapped
    o.held = JOB.lastPart - JOB.lastGoodCheck;
    o.scrapped = JOB.lastPart - firstBad + 1;
    o.escaped = 0;
    o.containMin = cost.containmentMinutes;
  } else {
    o.held = 0;
    o.scrapped = heldAtStation.length;
    o.escaped = bad.filter((p) => !(withNabz && p.rule === 'hold')).length;
    o.containMin = 0;
  }
  return o;
}

export function outcomes(scn, policy, cost = COST_DEFAULTS) {
  const run = runScenario(scn, policy);
  const base = runScenario(scn, 'ignore');   // same physics, nobody listening
  const perMin = (60 / JOB.cycleSec) * cost.marginPerPart;

  const B = settle(base.parts, cost, false);
  B.surfaces = B.teardownFails ? JOB.lastPart : null;
  B.checks = 0;
  B.stopMin = B.containMin;

  const N = settle(run.parts, cost, true);
  N.checks = run.interventions.length;
  N.stopMin = N.checks * DETECTOR.checkMinutes + N.containMin;
  const firstSignal = run.events.find((e) => e.type === 'advisory' || e.type === 'hold');
  N.surfaces = firstSignal ? firstSignal.part : null;
  N.surfaceType = firstSignal ? firstSignal.type : null;

  const price = (o) => {
    const c = {
      hold: (o.held + o.unverified) * cost.sortPerHeldPart,
      scrap: o.scrapped * cost.scrapPerPart,
      stop: Math.round(o.stopMin * perMin),
      escape: o.escaped * cost.escapePerPart,
    };
    c.total = c.hold + c.scrap + c.stop + c.escape;
    return c;
  };
  const bc = price(B), nc = price(N);
  const firstBad = B.firstBad;
  return {
    run, base, B, N, bc, nc, perMin, firstBad,
    avoided: bc.total - nc.total,
    warningParts: N.surfaces && B.surfaces ? B.surfaces - N.surfaces : null,
    warningMin: N.surfaces && B.surfaces ? minuteOf(B.surfaces) - minuteOf(N.surfaces) : null,
    leadParts: run.advisory && firstBad && firstBad > run.advisory.part ? firstBad - run.advisory.part : null,
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
export { minuteOf };
