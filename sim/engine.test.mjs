import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, outcomes, BASELINE, COST_DEFAULTS, JOB, DETECTOR, currentTrace, segmentArcs, PRESETS } from './engine.js';

const strip = (r) => JSON.stringify(r.parts.map((p) => [p.part, p.score, p.rule, p.drift, p.truth, p.k]));
const P = PRESETS;

test('same scenario + policy reproduces the same run', () => {
  for (const s of Object.values(P)) for (const d of ['act', 'ignore']) {
    assert.equal(strip(runScenario(s, d)), strip(runScenario(s, d)), `${s.id}/${d}`);
    assert.equal(JSON.stringify(outcomes(s, d)), JSON.stringify(outcomes(s, d)));
  }
});

test('threshold is fitted on known-good data only and sits above it', () => {
  assert.ok(BASELINE.threshold > Math.max(...BASELINE.valScores));
});

test('healthy run: no advisory, no hold, every weld sound, teardown passes', () => {
  const r = runScenario(P.healthy);
  assert.equal(r.advisory, null);
  assert.equal(r.parts.filter((p) => p.rule === 'hold').length, 0);
  assert.ok(r.parts.every((p) => p.truth === 'good'));
  const p127 = r.parts.find((p) => p.part === 127);
  assert.ok(Math.max(...p127.arcScores.map((a) => a.score)) > BASELINE.threshold * 2, 'grinder arc is loud');
  assert.ok(p127.score < BASELINE.threshold, 'but the part score ignores it');
  assert.equal(r.parts.find((p) => p.part === 196).rule, 'unverified');
  const o = outcomes(P.healthy, 'act');
  assert.equal(o.B.surfaces, null);
  assert.equal(o.bc.total, 0);
});

test('detector is causal: faults added later do not change earlier decisions', () => {
  const full = runScenario(P.fault, 'ignore');
  const adv = full.advisory.part;
  const later = runScenario({ ...P.fault, faults: [...P.fault.faults, { kind: 'skip', at: adv + 5, weld: 0 }, { kind: 'lot', at: adv + 1 }] }, 'ignore');
  const upTo = (r) => JSON.stringify(r.parts.filter((p) => p.part <= adv).map((p) => [p.score, p.drift, p.rule]));
  assert.equal(upTo(later), upTo(full));
});

test('worn tip: advisory precedes defects; part 0184 held when the advisory is ignored', () => {
  const ig = runScenario(P.fault, 'ignore');
  assert.equal(ig.advisory.part, 163);
  const firstBad = ig.parts.find((p) => p.truth !== 'good').part;
  assert.ok(ig.advisory.part < firstBad, 'advisory before first defective weld');
  const p184 = ig.parts.find((p) => p.part === 184);
  assert.equal(p184.rule, 'hold');
  assert.match(p184.reason, /3 of 4 welds · W3 missing/);
  assert.equal(ig.parts.find((p) => p.part === 163).rule, 'ok', 'weld count still fine at the alert');
  const act = runScenario(P.fault, 'act');
  assert.ok(act.parts.every((p) => p.truth === 'good'), 'tip change prevents the defects');
  assert.equal(act.intervention.found, 'wear');
});

test('wire lot: one advisory, check finds nothing, no defects, costs money', () => {
  const r = runScenario(P.borderline, 'act');
  assert.equal(r.advisories.length, 1);
  assert.equal(r.intervention.found, null);
  assert.ok(r.parts.some((p) => p.drift === 'watch'));
  assert.ok(r.parts.every((p) => p.truth === 'good'));
  assert.ok(outcomes(P.borderline, 'act').avoided < 0);
});

test('sandbox: a skipped weld is held by Nabz and ships without it', () => {
  const sc = { ...P.sandbox, faults: [{ kind: 'skip', at: 150, weld: 1 }] };
  const o = outcomes(sc, 'act');
  assert.equal(o.run.parts.find((p) => p.part === 150).rule, 'hold');
  assert.equal(o.B.escaped, 1);
  assert.equal(o.N.escaped, 0);
  assert.equal(o.bc.escape, COST_DEFAULTS.escapePerPart);
});

test('figures agree with their inputs', () => {
  const scs = [...Object.values(P), { ...P.sandbox, faults: [{ kind: 'wear', at: 120 }, { kind: 'skip', at: 130, weld: 3 }] }];
  for (const s of scs) for (const d of ['act', 'ignore']) {
    const c = { ...COST_DEFAULTS, scrapPerPart: 500, sortPerHeldPart: 30, escapePerPart: 7000 };
    const o = outcomes(s, d, c);
    const perMin = (60 / JOB.cycleSec) * c.marginPerPart;
    for (const [O, Pr] of [[o.B, o.bc], [o.N, o.nc]]) {
      assert.equal(Pr.hold, (O.held + O.unverified) * c.sortPerHeldPart);
      assert.equal(Pr.scrap, O.scrapped * c.scrapPerPart);
      assert.equal(Pr.stop, Math.round(O.stopMin * perMin));
      assert.equal(Pr.escape, O.escaped * c.escapePerPart);
      assert.equal(Pr.total, Pr.hold + Pr.scrap + Pr.stop + Pr.escape);
    }
    assert.equal(o.avoided, o.bc.total - o.nc.total);
    if (o.B.teardownFails) assert.equal(o.B.held, JOB.lastPart - JOB.lastGoodCheck);
  }
  const f = outcomes(P.fault, 'act');
  assert.equal(f.avoided, 25050);
  assert.equal(f.nc.stop, Math.round(DETECTOR.checkMinutes * f.perMin));
});

test('segmentation: dwell filter rejects failed starts', () => {
  assert.equal(segmentArcs(currentTrace(184, 0.7, [2])).length, 3);
  assert.equal(segmentArcs(currentTrace(150, 0, [])).length, 4);
});
