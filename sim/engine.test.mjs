import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, outcomes, baselineTruth, BASELINE, COST_DEFAULTS, JOB, DETECTOR, currentTrace, segmentArcs, SCENARIOS } from './engine.js';

const strip = (r) => JSON.stringify(r.parts.map((p) => [p.part, p.score, p.rule, p.drift, p.truth, p.k]));

test('same scenario + decision reproduces the same run', () => {
  for (const s of Object.keys(SCENARIOS)) for (const d of ['act', 'ignore']) {
    assert.equal(strip(runScenario(s, d)), strip(runScenario(s, d)), `${s}/${d}`);
    assert.equal(JSON.stringify(outcomes(s, d)), JSON.stringify(outcomes(s, d)));
  }
});

test('threshold is fitted on known-good data only and sits above it', () => {
  assert.ok(BASELINE.threshold > Math.max(...BASELINE.valScores));
});

test('healthy run: no advisory, no hold, every weld sound, teardown passes', () => {
  const r = runScenario('healthy');
  assert.equal(r.advisory, null);
  assert.equal(r.parts.filter((p) => p.rule === 'hold').length, 0);
  assert.ok(r.parts.every((p) => p.truth === 'good'));
  // the loud grinder arc on 0127 is visible in its arc score but not in the part score
  const p127 = r.parts.find((p) => p.part === 127);
  assert.ok(Math.max(...p127.arcScores.map((a) => a.score)) > BASELINE.threshold * 2);
  assert.ok(p127.score < BASELINE.threshold);
  // dropout is unverified, not held
  assert.equal(r.parts.find((p) => p.part === 196).rule, 'unverified');
  const o = outcomes('healthy', 'act');
  assert.equal(o.B.surfaces, null);
  assert.equal(o.bc.total, 0);
});

test('detector is causal: changing the future does not change past decisions', () => {
  const full = runScenario('fault', 'ignore');
  const adv = full.advisory.part;
  // truncate the drift after the advisory: earlier states must be identical
  const orig = SCENARIOS.fault.drift;
  SCENARIOS.fault.drift = (p) => (p > adv ? 0 : orig(p));
  try {
    const cut = runScenario('fault', 'ignore');
    const upTo = (r) => JSON.stringify(r.parts.filter((p) => p.part <= adv).map((p) => [p.score, p.drift, p.rule]));
    assert.equal(upTo(cut), upTo(full));
    assert.equal(cut.advisory.part, adv);
  } finally { SCENARIOS.fault.drift = orig; }
});

test('fault run: advisory precedes defects; missed weld 0184 held when the advisory is ignored', () => {
  const ig = runScenario('fault', 'ignore');
  const firstBad = ig.parts.find((p) => p.truth !== 'good').part;
  assert.ok(ig.advisory.part < firstBad, 'advisory before first defective weld');
  const p184 = ig.parts.find((p) => p.part === 184);
  assert.equal(p184.rule, 'hold');
  assert.match(p184.reason, /3 of 4 welds · W3 missing/);
  // the weld still looks normal at detection: count and durations in recipe
  const atAdv = ig.parts.find((p) => p.part === ig.advisory.part);
  assert.equal(atAdv.rule, 'ok');
  const act = runScenario('fault', 'act');
  assert.ok(act.parts.every((p) => p.truth === 'good'), 'tip change prevents the defects');
  assert.equal(act.parts.find((p) => p.part === 184).rule, 'ok');
});

test('borderline: one advisory, check finds nothing, no defects', () => {
  const r = runScenario('borderline', 'act');
  assert.equal(r.events.filter((e) => e.type === 'advisory' || e.type === 'advisory-repeat').length, 1);
  assert.ok(r.parts.some((p) => p.drift === 'watch'));
  assert.ok(r.parts.every((p) => p.truth === 'good'));
  const o = outcomes('borderline', 'act');
  assert.ok(o.avoided < 0, 'a false alert costs money and the demo says so');
});

test('figures agree with their inputs', () => {
  for (const s of Object.keys(SCENARIOS)) for (const d of ['act', 'ignore']) {
    const c = { ...COST_DEFAULTS, scrapPerPart: 500, sortPerHeldPart: 30 };
    const o = outcomes(s, d, c);
    const perMin = (60 / JOB.cycleSec) * c.marginPerPart;
    for (const [O, P] of [[o.B, o.bc], [o.N, o.nc]]) {
      assert.equal(P.hold, (O.held + (O.unverified || 0)) * c.sortPerHeldPart);
      assert.equal(P.scrap, O.scrapped * c.scrapPerPart);
      assert.equal(P.stop, Math.round(O.stopMin * perMin));
      assert.equal(P.total, P.hold + P.scrap + P.stop);
    }
    assert.equal(o.avoided, o.bc.total - o.nc.total);
    if (o.B.surfaces) {
      assert.equal(o.B.held, JOB.lastPart - JOB.lastGoodCheck);
      const bt = baselineTruth(s);
      assert.equal(o.B.scrapped, JOB.lastPart - bt.find((b) => b.truth !== 'good').part + 1);
    }
  }
  const f = outcomes('fault', 'act');
  assert.equal(f.warningParts, JOB.lastPart - f.run.advisory.part);
  assert.equal(f.nc.stop, Math.round(DETECTOR.checkMinutes * f.perMin));
});

test('segmentation: dwell filter rejects failed starts', () => {
  const tr = currentTrace(SCENARIOS.fault, 184, 0.7, false, true);
  const arcs = segmentArcs(tr);
  assert.equal(arcs.length, 3);
});
